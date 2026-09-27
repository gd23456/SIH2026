// Product video, made on the phone.
//
// Photo in, ~7-second 9:16 promo out: the enhanced product shot with a slow
// Ken Burns move over a blurred backdrop of itself, the product name, price
// and badges easing in, and a Karigar/ONDC end strip. Sized for WhatsApp
// Status and Instagram Reels.
//
// Why on-device and not a backend or a video-AI API:
//   * "Nothing may break the demo." Rendering here needs no network, no key,
//     no server — it works on the demo hotspot with the laptop unplugged.
//   * Uploading a photo and downloading a multi-MB video over venue wifi is the
//     slowest, flakiest thing the app could do. Rendering locally is not.
//   * It is deterministic: the same photo, details and look always produce the
//     same composition, so the demo looks the same every time.
//
// How: draw every frame to a <canvas>, capture it with canvas.captureStream()
// and encode with MediaRecorder — MP4 where the WebView can (Chromium 126+,
// Safari), WebM otherwise. Recording is real-time, so a 7s video takes ~7s,
// which the UI turns into a progress bar.
//
// The fallback chain never ends empty-handed:
//   1. MP4 video      — shares cleanly to WhatsApp / Instagram
//   2. WebM video     — older Chromium WebViews
//   3. Product card   — a PNG of the same composition, rendered FIRST so it
//                       exists even if MediaRecorder is missing or throws.
// createProductVideo() therefore only rejects if the photo itself can't be
// decoded, or the caller aborts.

export const VIDEO_W = 720;
export const VIDEO_H = 1280;
export const VIDEO_MS = 7000;
const FPS = 30;

export const LOOKS = ["zoom", "pan", "spotlight"];

// Warm clay palette from tailwind.config.js — the video should look like it
// came from the same app as the screen that made it.
const C = {
  ink: "#2a1a0f",
  clay900: "#5a3720",
  clay600: "#a4652f",
  clay100: "#f3e9dc",
  haldi: "#e8a13a",
  leaf: "#3f7d5a",
  white: "#ffffff",
};

const FONT = `"Poppins", "Noto Sans", system-ui, -apple-system, "Segoe UI", sans-serif`;

// Preference order. avc1 first: WhatsApp and Instagram accept MP4/H.264
// everywhere; WebM is a playable-in-app fallback, not a great share format.
const MIME_CANDIDATES = [
  ["video/mp4;codecs=avc1.42E01E", "mp4"],
  ["video/mp4;codecs=avc1", "mp4"],
  ["video/mp4", "mp4"],
  ["video/webm;codecs=vp9", "webm"],
  ["video/webm;codecs=vp8", "webm"],
  ["video/webm", "webm"],
];

/** Best recordable format on this device, or null if video can't be recorded. */
export function videoSupport() {
  try {
    if (typeof MediaRecorder === "undefined") return null;
    if (typeof HTMLCanvasElement === "undefined" || !HTMLCanvasElement.prototype.captureStream) return null;
    for (const [mime, ext] of MIME_CANDIDATES) {
      if (MediaRecorder.isTypeSupported?.(mime)) return { mime, ext };
    }
  } catch {
    // Some WebViews throw from isTypeSupported instead of returning false.
  }
  return null;
}

// ---------------------------------------------------------------- helpers ---

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const easeOut = (v) => 1 - Math.pow(1 - clamp01(v), 3);
const easeInOut = (v) => {
  const x = clamp01(v);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
/** 0→1 over [start, start+dur] ms, eased. */
const phase = (t, start, dur) => easeOut((t - start) / dur);

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image-load"));
    img.src = src;
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draw `img` to cover the (dx,dy,dw,dh) box, zoomed by `scale`, shifted by (ox,oy) fractions. */
function drawCover(ctx, img, dx, dy, dw, dh, scale = 1, ox = 0, oy = 0) {
  const ir = img.width / img.height;
  const br = dw / dh;
  let sw, sh;
  if (ir > br) {
    sh = img.height;
    sw = sh * br;
  } else {
    sw = img.width;
    sh = sw / br;
  }
  sw /= scale;
  sh /= scale;
  const maxX = (img.width - sw) / 2;
  const maxY = (img.height - sh) / 2;
  const sx = maxX + ox * maxX;
  const sy = maxY + oy * maxY;
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

/** Greedy word wrap; long single words are hard-cut with an ellipsis. */
function wrapLines(ctx, text, maxWidth, maxLines) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width <= maxWidth || !line) line = next;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last.length > 1 && ctx.measureText(last + "…").width > maxWidth) last = last.slice(0, -1);
    kept[maxLines - 1] = last + "…";
    return kept;
  }
  return lines.map((l) => {
    let s = l;
    if (ctx.measureText(s).width <= maxWidth) return s;
    while (s.length > 1 && ctx.measureText(s + "…").width > maxWidth) s = s.slice(0, -1);
    return s + "…";
  });
}

function pill(ctx, x, y, text, { bg, fg, size = 26, padX = 22, h = 52 }) {
  ctx.font = `700 ${size}px ${FONT}`;
  const w = ctx.measureText(text).width + padX * 2;
  ctx.fillStyle = bg;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + padX, y + h / 2 + 1);
  ctx.textBaseline = "alphabetic";
  return w;
}

/**
 * Pre-render the static layers once: a blurred, darkened cover of the photo
 * for the backdrop. Downscale-then-upscale is a blur that works on every
 * canvas — ctx.filter = "blur()" is missing on older Safari/WebViews.
 */
function buildBackdrop(img) {
  const tiny = document.createElement("canvas");
  tiny.width = 27;
  tiny.height = 48;
  const tctx = tiny.getContext("2d");
  drawCover(tctx, img, 0, 0, tiny.width, tiny.height, 1.25);

  const bg = document.createElement("canvas");
  bg.width = VIDEO_W;
  bg.height = VIDEO_H;
  const b = bg.getContext("2d");
  b.imageSmoothingEnabled = true;
  b.imageSmoothingQuality = "high";
  b.drawImage(tiny, 0, 0, VIDEO_W, VIDEO_H);
  // Warm wash + a darker lower third so white type always reads.
  const g = b.createLinearGradient(0, 0, 0, VIDEO_H);
  g.addColorStop(0, "rgba(90,55,32,0.45)");
  g.addColorStop(0.55, "rgba(60,36,20,0.55)");
  g.addColorStop(1, "rgba(30,18,10,0.92)");
  b.fillStyle = g;
  b.fillRect(0, 0, VIDEO_W, VIDEO_H);
  return bg;
}

// Ken Burns per look: {scale, ox, oy} at progress p (0→1 across the clip).
const MOTION = {
  zoom: (p) => ({ scale: 1 + 0.14 * easeInOut(p), ox: 0, oy: -0.15 * easeInOut(p) }),
  pan: (p) => ({ scale: 1.14, ox: -0.8 + 1.6 * easeInOut(p), oy: 0 }),
  spotlight: (p) => ({ scale: 1.16 - 0.14 * easeInOut(p), ox: 0, oy: 0 }),
};

// ----------------------------------------------------------------- frame ---

/**
 * Draw one frame at time t (ms). Pure function of (t, inputs) — which is what
 * makes the poster and every regenerate reproducible.
 */
function drawFrame(ctx, t, { img, backdrop, logo, details, look }) {
  const W = VIDEO_W;
  const H = VIDEO_H;
  const p = t / VIDEO_MS;

  ctx.save();
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(backdrop, 0, 0);

  // --- product card -------------------------------------------------------
  const enter = phase(t, 0, 800);
  const size = 600;
  const cx = (W - size) / 2;
  const cy = 150 + (1 - enter) * 50;
  const cardScale = 0.95 + 0.05 * enter;
  ctx.save();
  ctx.globalAlpha = enter;
  ctx.translate(W / 2, cy + size / 2);
  ctx.scale(cardScale, cardScale);
  ctx.translate(-W / 2, -(cy + size / 2));
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 24;
  ctx.fillStyle = C.clay100;
  roundRect(ctx, cx, cy, size, size, 40);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.save();
  roundRect(ctx, cx, cy, size, size, 40);
  ctx.clip();
  const m = (MOTION[look] || MOTION.zoom)(p);
  drawCover(ctx, img, cx, cy, size, size, m.scale, m.ox, m.oy);
  if (look === "spotlight") {
    // A soft band of light sweeping across the piece, once.
    const sweep = -0.4 + 1.8 * easeInOut(clamp01((t - 600) / 3200));
    const sx = cx + sweep * size;
    const lg = ctx.createLinearGradient(sx - 160, cy, sx + 160, cy + size);
    lg.addColorStop(0, "rgba(255,255,255,0)");
    lg.addColorStop(0.5, "rgba(255,244,225,0.28)");
    lg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = lg;
    ctx.fillRect(cx, cy, size, size);
  }
  ctx.restore();
  ctx.restore();

  // --- text block ----------------------------------------------------------
  const left = 60;
  const maxW = W - left * 2;
  let y = 842;

  // Eyebrow: the registry name when GI is verified — the strongest claim a
  // listing can make — otherwise a plain "handmade" line.
  const eb = phase(t, 900, 500);
  ctx.globalAlpha = eb;
  ctx.fillStyle = details.giVerified ? "#9fd9b4" : C.haldi;
  ctx.font = `700 24px ${FONT}`;
  const eyebrow = details.giVerified && details.giName
    ? `✓ GI VERIFIED · ${details.giName}`.toUpperCase()
    : "HANDMADE IN INDIA";
  ctx.fillText(wrapLines(ctx, eyebrow, maxW, 1)[0] || "", left, y + (1 - eb) * 16);
  y += 22;

  {
    // Before the listing exists (video made from the photo step) there is no
    // name yet, so the headline is a plain line about the piece instead.
    const tt = phase(t, 1100, 600);
    ctx.globalAlpha = tt;
    ctx.fillStyle = C.white;
    // Step the size down for long names rather than cutting them off —
    // craft titles ("Channapatna Wooden Spinning Top Set") run long.
    const headline = details.title || "Made by hand, with care";
    let size = 52;
    ctx.font = `800 ${size}px ${FONT}`;
    while (size > 40 && wrapLines(ctx, headline, maxW, 3).length > 2) {
      size -= 4;
      ctx.font = `800 ${size}px ${FONT}`;
    }
    const lines = wrapLines(ctx, headline, maxW, 2);
    for (const line of lines) {
      y += size + 10;
      ctx.fillText(line, left, y + (1 - tt) * 24);
    }
  }

  if (details.nativeTitle) {
    const nt = phase(t, 1500, 600);
    ctx.globalAlpha = nt * 0.85;
    ctx.fillStyle = C.clay100;
    ctx.font = `500 32px ${FONT}`;
    y += 48;
    ctx.fillText(wrapLines(ctx, details.nativeTitle, maxW, 1)[0] || "", left, y + (1 - nt) * 16);
  }

  // Price + badges row.
  y += 34;
  let x = left;
  if (details.price > 0) {
    const pt = phase(t, 2200, 450);
    ctx.globalAlpha = pt;
    const s = 0.9 + 0.1 * pt;
    ctx.save();
    ctx.translate(x, y + 32);
    ctx.scale(s, s);
    x += pill(ctx, 0, -32, "₹" + Number(details.price).toLocaleString("en-IN"), {
      bg: C.haldi, fg: C.ink, size: 36, h: 64, padX: 26,
    }) * s + 14;
    ctx.restore();
  }
  const badges = [];
  if (details.giVerified) badges.push({ text: "✓ Verified GI", bg: C.leaf, fg: C.white });
  badges.push({ text: "Handmade", bg: "rgba(255,255,255,0.16)", fg: C.white });
  badges.forEach((bd, i) => {
    const bt = phase(t, 2800 + i * 160, 400);
    ctx.globalAlpha = bt;
    ctx.font = `700 24px ${FONT}`;
    const w = ctx.measureText(bd.text).width + 40;
    if (x + w > W - left) return; // never overflow the frame
    pill(ctx, x, y + 6, bd.text, { bg: bd.bg, fg: bd.fg, size: 24, h: 52, padX: 20 });
    x += w + 12;
  });

  // --- end strip ------------------------------------------------------------
  const st = phase(t, 4400, 600);
  ctx.globalAlpha = st;
  const sy = H - 140;
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  roundRect(ctx, left, sy, maxW, 88, 26);
  ctx.fill();
  if (logo) {
    ctx.save();
    roundRect(ctx, left + 16, sy + 16, 56, 56, 14);
    ctx.clip();
    ctx.drawImage(logo, left + 16, sy + 16, 56, 56);
    ctx.restore();
  }
  ctx.fillStyle = C.white;
  ctx.font = `800 28px ${FONT}`;
  ctx.fillText("Karigar AI", left + (logo ? 88 : 24), sy + 54);
  ctx.font = `600 22px ${FONT}`;
  ctx.fillStyle = C.clay100;
  const cta = details.live ? "Order now on ONDC" : "Handmade · Fairly priced";
  const ctaW = ctx.measureText(cta).width;
  ctx.fillText(cta, left + maxW - 24 - ctaW, sy + 52);

  // --- fades: in from and out to dark, so the clip loops cleanly -------------
  ctx.globalAlpha = 1;
  const fadeIn = 1 - clamp01(t / 350);
  const fadeOut = clamp01((t - (VIDEO_MS - 450)) / 450);
  const dark = Math.max(fadeIn, fadeOut);
  if (dark > 0) {
    ctx.fillStyle = `rgba(30,18,10,${dark})`;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

// ------------------------------------------------------------------ public ---

const POSTER_T = 4200; // every detail visible, end strip not yet in

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), type, quality);
  });
}

function abortError() {
  const e = new Error("aborted");
  e.name = "AbortError";
  return e;
}

/**
 * Render the video into `canvas` (shown live in the UI while it records).
 *
 * @param {object}   o
 * @param {HTMLCanvasElement} o.canvas  720×1280 target — visible preview
 * @param {string}   o.imageSrc         data: URL of the enhanced photo
 * @param {object}   o.details          {title, nativeTitle, price, giVerified, giName, live}
 * @param {string}   o.look             one of LOOKS
 * @param {Function} o.onProgress       ({stage, pct}) — stage: prepare|create|details|finalize
 * @param {AbortSignal} [o.signal]
 * @returns {Promise<{kind:"video"|"poster", url?, blob?, ext?, mime?, poster:{url,blob}}>}
 */
export async function createProductVideo({ canvas, imageSrc, details = {}, look = "zoom", onProgress, signal }) {
  const report = (stage, pct) => onProgress?.({ stage, pct });
  report("prepare", 0);

  // Wait (briefly) for Poppins so the first frames aren't in a fallback font —
  // but never block on it: offline, it will simply never arrive.
  try {
    await Promise.race([document.fonts?.ready, new Promise((r) => setTimeout(r, 800))]);
  } catch {}

  const img = await loadImage(imageSrc); // the one failure we surface
  const logo = await loadImage("/icon-512.png").catch(() => null);
  if (signal?.aborted) throw abortError();

  const inputs = { img, backdrop: buildBackdrop(img), logo, details, look };
  canvas.width = VIDEO_W;
  canvas.height = VIDEO_H;
  const ctx = canvas.getContext("2d");

  // The card first, so it exists whatever happens to the recorder.
  drawFrame(ctx, POSTER_T, inputs);
  const posterBlob = await canvasToBlob(canvas, "image/jpeg", 0.92);
  const poster = { blob: posterBlob, url: URL.createObjectURL(posterBlob) };
  report("prepare", 0.05);

  const fmt = videoSupport();
  if (!fmt) return { kind: "poster", poster, reason: "unsupported" };

  let rec;
  let stream;
  try {
    stream = canvas.captureStream(FPS);
    rec = new MediaRecorder(stream, { mimeType: fmt.mime, videoBitsPerSecond: 5_000_000 });
    const chunks = [];
    rec.ondataavailable = (e) => e.data && e.data.size && chunks.push(e.data);
    const stopped = new Promise((resolve, reject) => {
      rec.onstop = resolve;
      rec.onerror = (e) => reject(e?.error || new Error("recorder"));
    });

    drawFrame(ctx, 0, inputs);
    rec.start(250);
    const t0 = performance.now();

    // setTimeout rather than requestAnimationFrame: rAF stops dead in a
    // background tab, which would freeze the recording mid-clip. Timers only
    // slow down, and the frame for "now" is always drawn, so the video stays
    // the right length either way.
    await new Promise((resolve, reject) => {
      const tick = () => {
        if (signal?.aborted) return reject(abortError());
        const t = Math.min(performance.now() - t0, VIDEO_MS);
        drawFrame(ctx, t, inputs);
        const pct = t / VIDEO_MS;
        report(pct < 0.45 ? "create" : "details", 0.05 + pct * 0.85);
        if (t >= VIDEO_MS) resolve();
        else setTimeout(tick, 1000 / FPS);
      };
      tick();
    });

    report("finalize", 0.93);
    // Hold the last frame a beat so the encoder flushes it.
    await new Promise((r) => setTimeout(r, 120));
    rec.stop();
    await stopped;
    stream.getTracks().forEach((tr) => tr.stop());

    const type = fmt.mime.split(";")[0];
    const blob = new Blob(chunks, { type });
    // A few KB means the encoder produced headers and no frames — some
    // WebViews report support and then deliver nothing. Treat as unsupported.
    if (blob.size < 20_000) return { kind: "poster", poster, reason: "empty" };

    report("finalize", 1);
    return { kind: "video", blob, url: URL.createObjectURL(blob), ext: fmt.ext, mime: type, poster };
  } catch (err) {
    try {
      if (rec && rec.state !== "inactive") rec.stop();
      stream?.getTracks().forEach((tr) => tr.stop());
    } catch {}
    if (err?.name === "AbortError") {
      URL.revokeObjectURL(poster.url);
      throw err;
    }
    console.warn("product video: recording failed, using product card", err);
    return { kind: "poster", poster, reason: "failed" };
  }
}

/** Release the object URLs held by a result. Safe on null. */
export function releaseVideo(result) {
  if (!result) return;
  try {
    if (result.url) URL.revokeObjectURL(result.url);
    if (result.poster?.url) URL.revokeObjectURL(result.poster.url);
  } catch {}
}

/** Product details for the video, from whatever the flow has so far. */
export function videoDetails({ listing, price, lang, live = false }) {
  if (!listing) return { price: 0, live };
  const en = listing.title?.en || "";
  const native = lang && lang !== "en" ? listing.title?.[lang] || "" : "";
  return {
    title: en,
    nativeTitle: native && native !== en ? native : "",
    price: Number(price) || 0,
    giVerified: Boolean(listing.gi_verified),
    giName: listing.gi_registry_name || "",
    live,
  };
}
