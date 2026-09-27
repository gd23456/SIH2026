// Shareable product card: one 1080×1350 (4:5 — Instagram feed and WhatsApp
// both show it uncropped) image with the photo, name, price, GI badge and the
// storefront QR code. For artisans who sell in WhatsApp groups, this picture
// IS the listing — so it carries the way to order on it.

import { qrUrl } from "./api";

const W = 1080;
const H = 1350;
const FONT = `"Poppins", "Noto Sans", system-ui, sans-serif`;

function load(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = src;
  });
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrap(ctx, text, maxW, maxLines) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width <= maxW || !line) line = next;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const cut = lines.slice(0, maxLines);
    let last = cut[maxLines - 1];
    while (last.length > 1 && ctx.measureText(last + "…").width > maxW) last = last.slice(0, -1);
    cut[maxLines - 1] = last + "…";
    return cut;
  }
  return lines;
}

/**
 * @returns {Promise<Blob>} JPEG. Works without a network: if the QR can't be
 * fetched the card prints the link instead.
 */
export async function renderProductCard({ imageB64, title, nativeTitle, price, giName, giVerified, listingId, link }) {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  try {
    await Promise.race([document.fonts?.ready, new Promise((r) => setTimeout(r, 600))]);
  } catch {}

  ctx.fillStyle = "#faf6f0";
  ctx.fillRect(0, 0, W, H);

  // photo
  const photo = await load(`data:image/png;base64,${imageB64}`);
  const ph = 760;
  ctx.save();
  rr(ctx, 48, 48, W - 96, ph, 40);
  ctx.clip();
  const s = Math.max((W - 96) / photo.width, ph / photo.height);
  const dw = photo.width * s;
  const dh = photo.height * s;
  ctx.drawImage(photo, 48 + (W - 96 - dw) / 2, 48 + (ph - dh) / 2, dw, dh);
  ctx.restore();

  // GI badge on the photo
  if (giVerified && giName) {
    ctx.font = `700 30px ${FONT}`;
    const label = `✓ GI · ${giName}`;
    const w = Math.min(ctx.measureText(label).width + 44, W - 160);
    ctx.fillStyle = "#3f7d5a";
    rr(ctx, 76, 76, w, 58, 29);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.textBaseline = "middle";
    ctx.fillText(wrap(ctx, label, w - 44, 1)[0], 98, 106);
    ctx.textBaseline = "alphabetic";
  }

  // text block
  const left = 64;
  const qrSize = 300;
  const textW = W - left * 2 - qrSize - 40;
  let y = 48 + ph + 86;
  ctx.fillStyle = "#2a1a0f";
  ctx.font = `800 54px ${FONT}`;
  for (const line of wrap(ctx, title, textW, 2)) {
    ctx.fillText(line, left, y);
    y += 64;
  }
  if (nativeTitle) {
    ctx.fillStyle = "#874f27";
    ctx.font = `600 34px ${FONT}`;
    ctx.fillText(wrap(ctx, nativeTitle, textW, 1)[0] || "", left, y);
    y += 50;
  }
  if (price > 0) {
    ctx.font = `800 56px ${FONT}`;
    const ptxt = "₹" + Number(price).toLocaleString("en-IN");
    const pw = ctx.measureText(ptxt).width + 56;
    ctx.fillStyle = "#e8a13a";
    rr(ctx, left, y - 8, pw, 84, 42);
    ctx.fill();
    ctx.fillStyle = "#2a1a0f";
    ctx.textBaseline = "middle";
    ctx.fillText(ptxt, left + 28, y + 35);
    ctx.textBaseline = "alphabetic";
  }

  // QR, or the link when offline
  const qx = W - left - qrSize;
  const qy = 48 + ph + 40;
  ctx.fillStyle = "#fff";
  rr(ctx, qx - 12, qy - 12, qrSize + 24, qrSize + 24, 24);
  ctx.fill();
  let qrDrawn = false;
  if (listingId) {
    try {
      const res = await fetch(qrUrl(listingId));
      if (res.ok) {
        const bmp = await createImageBitmap(await res.blob());
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(bmp, qx, qy, qrSize, qrSize);
        qrDrawn = true;
      }
    } catch {}
  }
  ctx.fillStyle = "#6d4124";
  ctx.font = `600 24px ${FONT}`;
  if (qrDrawn) {
    ctx.textAlign = "center";
    ctx.fillText("Scan to order", qx + qrSize / 2, qy + qrSize + 52);
    ctx.textAlign = "left";
  } else if (link) {
    for (const [i, line] of wrap(ctx, link, qrSize, 6).entries()) ctx.fillText(line, qx, qy + 40 + i * 34);
  }

  // footer
  ctx.fillStyle = "#874f27";
  ctx.font = `700 26px ${FONT}`;
  ctx.fillText("Karigar AI · Handmade in India · on ONDC", left, H - 44);

  return new Promise((res) => c.toBlob(res, "image/jpeg", 0.92));
}
