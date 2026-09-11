// API layer with automatic demo fallback.
// - Live: talks to the FastAPI backend (Gemini + rembg).
// - Demo: if the backend is unreachable OR demo mode is forced, uses
//   client-side canned data so the app never breaks on stage / on-device.

import {
  demoListing,
  demoListings,
  demoPrice,
  demoPublish,
  demoSearch,
  demoChannels,
  demoImpact,
} from "./demoData";

function isNative() {
  return typeof window !== "undefined" && window.Capacitor?.isNativePlatform?.();
}

// Resolve the backend base URL.
export function apiBase() {
  try {
    const override = localStorage.getItem("karigar_api_base");
    if (override) return override.replace(/\/$/, "");
  } catch {}
  if (import.meta.env?.VITE_API_BASE) return import.meta.env.VITE_API_BASE.replace(/\/$/, "");
  // Android emulator maps host machine to 10.0.2.2
  if (isNative()) return "http://10.0.2.2:8000";
  return "http://localhost:8000";
}

/** Persist a backend address chosen in the Connection sheet. */
export function setApiBase(url) {
  const clean = String(url || "").trim().replace(/\/+$/, "");
  try {
    if (clean) localStorage.setItem("karigar_api_base", clean);
    else localStorage.removeItem("karigar_api_base");
  } catch {}
  return clean;
}

/** True when running inside the Capacitor Android shell rather than a browser. */
export function isNativeApp() {
  return Boolean(isNative());
}

/**
 * Open a URL outside the app.
 *
 * `target="_blank"` looks like it works and doesn't: Capacitor's WebView is
 * created with multiple-window support disabled, so on a device the tap is
 * silently swallowed and the storefront never opens. Navigating the current
 * frame to a foreign origin IS handled — Capacitor intercepts it and hands the
 * URL to the system browser, leaving the app running behind it.
 */
export function openExternal(url) {
  if (!url) return;
  if (isNative()) window.location.href = url;
  else window.open(url, "_blank", "noopener");
}

/**
 * Probe a backend without falling back to demo data.
 *
 * Every other call in this file silently degrades to canned data, which is
 * right for the demo but useless when you are trying to find out whether the
 * phone can actually see the laptop. This one reports the truth.
 */
export async function checkHealth(base) {
  const target = String(base || apiBase()).trim().replace(/\/+$/, "");
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(`${target}/api/health`, { signal: ctrl.signal });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = await res.json();
    return { ok: true, mode: data.mode, model: data.model, base: target };
  } catch (e) {
    return { ok: false, error: e?.name === "AbortError" ? "timeout" : "unreachable" };
  } finally {
    clearTimeout(to);
  }
}

export function forcedDemo() {
  try {
    return localStorage.getItem("karigar_demo") === "1";
  } catch {
    return false;
  }
}

// track where the last response came from, so the UI can show a badge
let _lastSource = "live";
export const getLastSource = () => _lastSource;

// The backend sets X-Karigar-Mode: live|mock so we can tell whether real Gemini
// answered even when the backend itself is reachable. jfetch captures it here.
let _lastBackendMode = null;

// Cheap calls (health, listings, channels) answer in well under a second, so
// 12s is generous for them. The AI endpoints are a different story — measured
// against live Gemini, generate-listing took 27s and price took 25s. At the old
// shared 12s ceiling those calls were aborted mid-flight and silently fell back
// to canned data, which looked exactly like "the AI is broken" even with a
// valid key. Slow is fine here; wrong is not.
const AI_TIMEOUT_MS = 60000; // 9-language listing generation is more output than the old 3

async function jfetch(path, opts = {}, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeoutMs);
  _lastBackendMode = null;
  try {
    const res = await fetch(apiBase() + path, { ...opts, signal: ctrl.signal });
    if (!res.ok) throw new Error("HTTP " + res.status);
    _lastBackendMode = res.headers.get("X-Karigar-Mode"); // "live" | "mock" | null
    return await res.json();
  } finally {
    clearTimeout(to);
  }
}

/**
 * Downscale a big phone photo (in the browser) before upload, so enhance is
 * fast even on a hotspot. Reads the source ONCE via createImageBitmap and hands
 * back an in-memory JPEG File that is safe to re-read (upload + b64 fallback).
 * Any failure returns the original File — never blocks the upload.
 */
async function downscaleForUpload(file, maxDim = 1600, quality = 0.85) {
  try {
    if (!file?.type?.startsWith("image/") || typeof createImageBitmap !== "function") return file;
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    const longest = Math.max(width, height);
    if (longest <= maxDim) {
      bitmap.close?.();
      return file;
    }
    const scale = maxDim / longest;
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", quality));
    if (!blob) return file;
    return new File([blob], (file.name || "photo") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file; // never block the upload on a downscale hiccup
  }
}

/** Send an image File; get {original_b64, enhanced_b64, bg_removed}. */
export async function enhanceImage(file) {
  // Downscale first (this reads the one-shot Android content:// URI exactly
  // once); the result is an in-memory File that both the upload and the b64
  // fallback below can safely read without re-consuming the original handle.
  const upload = await downscaleForUpload(file);
  let b64 = null;
  try {
    b64 = await fileToB64(upload);
  } catch {
    b64 = null;
  }

  if (forcedDemo()) {
    _lastSource = "demo";
    return demoEnhance(b64);
  }
  try {
    const fd = new FormData();
    fd.append("file", upload);
    const data = await jfetch("/api/enhance-image", { method: "POST", body: fd }, AI_TIMEOUT_MS);
    _lastSource = "live";
    return data;
  } catch (e) {
    _lastSource = "demo";
    return demoEnhance(b64);
  }
}

// Demo enhance: we can't cut the background client-side, so return the same
// image for both and let the UI apply a CSS "studio" treatment on the after.
// Takes already-read base64 rather than the File — see enhanceImage above.
function demoEnhance(b64) {
  return { original_b64: b64 || "", enhanced_b64: b64 || "", bg_removed: false, _demo: true };
}

export async function generateListing({ transcript, language, image_b64 }) {
  if (forcedDemo()) {
    _lastSource = "demo";
    return demoListing(transcript);
  }
  try {
    const data = await jfetch("/api/generate-listing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript, language, image_b64 }),
    }, AI_TIMEOUT_MS);
    // Honest badge: "AI" only when real Gemini answered, else the mock ran.
    _lastSource = _lastBackendMode === "mock" ? "demo" : "live";
    return data;
  } catch {
    _lastSource = "demo";
    return demoListing(transcript);
  }
}

export async function getPrice(listing) {
  const payload = {
    title: listing?.title?.en || "",
    material: listing.material,
    category: listing.category,
    craft_technique: listing.craft_technique,
    production_time: listing.production_time,
  };
  if (forcedDemo()) {
    _lastSource = "demo";
    return demoPrice(listing);
  }
  try {
    const data = await jfetch("/api/price", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }, AI_TIMEOUT_MS);
    _lastSource = _lastBackendMode === "mock" ? "demo" : "live";
    return data;
  } catch {
    _lastSource = "demo";
    return demoPrice(listing);
  }
}

export async function publish({
  listing, price, image_b64, artisan_name, location,
  channels = ["ondc"], artisan_uid = null, artisan_email = "", artisan_photo_url = "",
}) {
  if (forcedDemo()) {
    _lastSource = "demo";
    return demoPublish(listing, price, channels);
  }
  try {
    const data = await jfetch("/api/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        listing, price, image_b64, artisan_name, location,
        channels, artisan_uid, artisan_email, artisan_photo_url,
      }),
    });
    _lastSource = "live";
    return data;
  } catch {
    _lastSource = "demo";
    return demoPublish(listing, price, channels);
  }
}

// ---- accounts + channels (Phase 3) ----------------------------------------

/** Create/update the artisan account. Demo-safe: echoes back locally on failure. */
export async function upsertArtisan(payload) {
  try {
    return await jfetch("/api/artisan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    return { ...payload, plan: payload.plan || "free", listing_count: 0, _demo: true };
  }
}

export async function getArtisan(uid) {
  try {
    return await jfetch(`/api/artisan/${encodeURIComponent(uid)}`);
  } catch {
    return null;
  }
}

/** Channel registry + this artisan's connection status. Falls back to demo. */
export async function listChannels(uid = "") {
  if (forcedDemo()) return demoChannels();
  try {
    return await jfetch(`/api/channels?uid=${encodeURIComponent(uid)}`);
  } catch {
    return demoChannels();
  }
}

/** Impact numbers for an artisan. Falls back to demo numbers offline. */
export async function getImpact(uid) {
  if (forcedDemo() || !uid) return demoImpact();
  try {
    return await jfetch(`/api/impact/${encodeURIComponent(uid)}`);
  } catch {
    return demoImpact();
  }
}

/** Simulated connect — never sends credentials. */
export async function connectChannel(channelId, { uid, name }) {
  if (forcedDemo()) return { connected: true, mode: "demo", channel_id: channelId };
  try {
    return await jfetch(`/api/channels/${encodeURIComponent(channelId)}/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid, name }),
    });
  } catch {
    return { connected: true, mode: "demo", channel_id: channelId };
  }
}

/** URL of the server-rendered QR PNG for a listing. */
export function qrUrl(listingId) {
  return `${apiBase()}/api/qr/${encodeURIComponent(listingId)}`;
}

/**
 * Published listings, newest first. Falls back to canned rows.
 *
 * `uid` scopes the result to that artisan — "My Products". Without it you get
 * the whole catalogue, which is what the home screen's recent strip wants.
 */
export async function listListings(limit = 24, uid = "") {
  if (forcedDemo()) {
    _lastSource = "demo";
    return demoListings();
  }
  const q = uid ? `&uid=${encodeURIComponent(uid)}` : "";
  try {
    const data = await jfetch(`/api/listings?limit=${limit}${q}`);
    _lastSource = "live";
    return data;
  } catch {
    _lastSource = "demo";
    return demoListings();
  }
}

/**
 * Delete one of your own listings.
 *
 * Deliberately NOT wrapped in the demo fallback every other call here uses.
 * Everywhere else, falling back to canned data degrades gracefully; here it
 * would report a deletion that never happened and leave the row on screen
 * looking gone until the next refresh brought it back. A delete either
 * succeeded on the server or the caller needs to hear that it did not.
 *
 * @throws {Error} with `.status` set when the server refused.
 */
export async function deleteListing(listingId, uid) {
  const res = await fetch(
    `${apiBase()}/api/listings/${encodeURIComponent(listingId)}?uid=${encodeURIComponent(uid || "")}`,
    { method: "DELETE" },
  );
  if (!res.ok) {
    // 204 has no body, and neither do the error paths worth distinguishing.
    const err = new Error(`delete failed: HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return true;
}

/** Buyer-side search across the published catalog. Falls back to demo rows. */
export async function searchListings(query = "", limit = 24) {
  if (forcedDemo()) {
    _lastSource = "demo";
    return demoSearch(query);
  }
  try {
    const data = await jfetch(`/api/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    _lastSource = "live";
    return data;
  } catch {
    _lastSource = "demo";
    return demoSearch(query);
  }
}

export function fileToB64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
