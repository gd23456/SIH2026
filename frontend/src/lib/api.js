// API layer with automatic demo fallback.
// - Live: talks to the FastAPI backend (Gemini + rembg).
// - Demo: if the backend is unreachable OR demo mode is forced, uses
//   client-side canned data so the app never breaks on stage / on-device.

import { demoListing, demoListings, demoPrice, demoPublish } from "./demoData";

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

async function jfetch(path, opts = {}, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(apiBase() + path, { ...opts, signal: ctrl.signal });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  } finally {
    clearTimeout(to);
  }
}

/** Send an image File; get {original_b64, enhanced_b64, bg_removed}. */
export async function enhanceImage(file) {
  if (forcedDemo()) return demoEnhance(file);
  try {
    const fd = new FormData();
    fd.append("file", file);
    const data = await jfetch("/api/enhance-image", { method: "POST", body: fd }, 25000);
    _lastSource = "live";
    return data;
  } catch (e) {
    _lastSource = "demo";
    return demoEnhance(file);
  }
}

// Demo enhance: we can't cut the background client-side, so return the same
// image for both and let the UI apply a CSS "studio" treatment on the after.
async function demoEnhance(file) {
  const b64 = await fileToB64(file);
  return { original_b64: b64, enhanced_b64: b64, bg_removed: false, _demo: true };
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
    });
    _lastSource = "live";
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
    });
    _lastSource = "live";
    return data;
  } catch {
    _lastSource = "demo";
    return demoPrice(listing);
  }
}

export async function publish({ listing, price, image_b64, artisan_name, location }) {
  if (forcedDemo()) {
    _lastSource = "demo";
    return demoPublish(listing, price);
  }
  try {
    const data = await jfetch("/api/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listing, price, image_b64, artisan_name, location }),
    });
    _lastSource = "live";
    return data;
  } catch {
    _lastSource = "demo";
    return demoPublish(listing, price);
  }
}

/** URL of the server-rendered QR PNG for a listing. */
export function qrUrl(listingId) {
  return `${apiBase()}/api/qr/${encodeURIComponent(listingId)}`;
}

/** Everything published so far, newest first. Falls back to canned rows. */
export async function listListings(limit = 24) {
  if (forcedDemo()) {
    _lastSource = "demo";
    return demoListings();
  }
  try {
    const data = await jfetch(`/api/listings?limit=${limit}`);
    _lastSource = "live";
    return data;
  } catch {
    _lastSource = "demo";
    return demoListings();
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
