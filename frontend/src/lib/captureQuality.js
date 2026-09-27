// On-device photo checks for the guided 3D capture.
//
// Cheap enough to run on every preview frame of a low-end phone: everything
// works on a ~160px downscale. Advisory only — the capture screen always
// offers "Use anyway"; these checks never block an artisan.
//
// Product detection assumes what the capture tips ask for: a plain-ish
// background. Background colour is estimated from the frame border; pixels
// far from it are "product". When the border itself is busy (clutter) we
// can't tell product from background, so framing advice is skipped rather
// than guessed.

const W = 160;

/** Draw a video frame / image / canvas into a small analysis buffer. */
export function sample(source, srcW, srcH) {
  const h = Math.max(1, Math.round((W * srcH) / srcW));
  const c = document.createElement("canvas");
  c.width = W;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, W, h);
  return ctx.getImageData(0, 0, W, h);
}

function gray(img) {
  const { data, width, height } = img;
  const g = new Float32Array(width * height);
  for (let i = 0, p = 0; p < g.length; i += 4, p++) {
    g[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return g;
}

/** Variance of the Laplacian — the standard focus measure. Low = blurry. */
function sharpness(g, w, h) {
  let sum = 0;
  let sq = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = 4 * g[i] - g[i - 1] - g[i + 1] - g[i - w] - g[i + w];
      sum += lap;
      sq += lap * lap;
      n++;
    }
  }
  const mean = sum / n;
  return sq / n - mean * mean;
}

function exposure(g) {
  let sum = 0;
  let dark = 0;
  let bright = 0;
  for (const v of g) {
    sum += v;
    if (v < 28) dark++;
    else if (v > 245) bright++;
  }
  return { mean: sum / g.length, dark: dark / g.length, bright: bright / g.length };
}

/** Where the product is, by contrast with the border colour. */
function framing(img) {
  const { data, width: w, height: h } = img;
  const border = [];
  const push = (x, y) => {
    const i = (y * w + x) * 4;
    border.push([data[i], data[i + 1], data[i + 2]]);
  };
  for (let x = 0; x < w; x += 2) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y += 2) {
    push(0, y);
    push(w - 1, y);
  }
  const med = [0, 1, 2].map((k) => {
    const v = border.map((p) => p[k]).sort((a, b) => a - b);
    return v[v.length >> 1];
  });
  // How uniform is the background? A busy border means we can't judge.
  const spread =
    border.reduce((s, p) => s + Math.abs(p[0] - med[0]) + Math.abs(p[1] - med[1]) + Math.abs(p[2] - med[2]), 0) /
    border.length;
  if (spread > 55) return { known: false };

  const T = 42 + spread * 0.6;
  let minX = w, minY = h, maxX = -1, maxY = -1, count = 0, sx = 0, sy = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const d = Math.abs(data[i] - med[0]) + Math.abs(data[i + 1] - med[1]) + Math.abs(data[i + 2] - med[2]);
      if (d > T) {
        count++;
        sx += x;
        sy += y;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const frac = count / (w * h);
  if (frac < 0.015) return { known: true, visible: false };
  const area = ((maxX - minX + 1) * (maxY - minY + 1)) / (w * h);
  const edges =
    (minX <= 1 ? 1 : 0) + (maxX >= w - 2 ? 1 : 0) + (minY <= 1 ? 1 : 0) + (maxY >= h - 2 ? 1 : 0);
  return {
    known: true,
    visible: true,
    area,
    edges,
    dx: sx / count / w - 0.5, // + = product sits right of centre
    dy: sy / count / h - 0.5, // + = product sits below centre
  };
}

/** 16×16 normalised thumbnail for "is this the same shot again?" */
export function fingerprint(img) {
  const g = gray(img);
  const { width: w, height: h } = img;
  const out = new Float32Array(256);
  for (let by = 0; by < 16; by++) {
    for (let bx = 0; bx < 16; bx++) {
      let s = 0;
      let n = 0;
      for (let y = Math.floor((by * h) / 16); y < Math.floor(((by + 1) * h) / 16); y++) {
        for (let x = Math.floor((bx * w) / 16); x < Math.floor(((bx + 1) * w) / 16); x++) {
          s += g[y * w + x];
          n++;
        }
      }
      out[by * 16 + bx] = n ? s / n : 0;
    }
  }
  const mean = out.reduce((a, b) => a + b, 0) / 256;
  const sd = Math.sqrt(out.reduce((a, b) => a + (b - mean) ** 2, 0) / 256) || 1;
  return out.map((v) => (v - mean) / sd);
}

function distance(a, b) {
  let s = 0;
  for (let i = 0; i < 256; i++) s += Math.abs(a[i] - b[i]);
  return s / 256;
}

/**
 * Analyse one frame. Returns {level, key, checks}:
 *   level  "good" | "warn"
 *   key    the single most useful i18n message key to show
 *   checks [{id, ok}] for the post-capture checklist
 * `previous` is [{angle, fp}] of already-accepted views.
 */
export function analyse(img, previous = []) {
  const g = gray(img);
  const exp = exposure(g);
  const sharp = sharpness(g, img.width, img.height);
  const fr = framing(img);
  const fp = fingerprint(img);

  const issues = [];
  if (exp.mean < 55 || exp.dark > 0.5) issues.push("qTooDark");
  else if (exp.mean > 225 || exp.bright > 0.4) issues.push("qTooBright");
  if (sharp < 45) issues.push("qBlurry");

  if (fr.known) {
    if (!fr.visible) issues.push("qNotVisible");
    else {
      if (fr.edges >= 2 || fr.area > 0.9) issues.push("qMoveBack");
      else if (fr.area < 0.1) issues.push("qMoveCloser");
      // Phone moves the opposite way the product appears to sit.
      if (fr.dx > 0.14) issues.push("qMoveRight");
      else if (fr.dx < -0.14) issues.push("qMoveLeft");
      else if (Math.abs(fr.dy) > 0.16) issues.push("qCenter");
    }
  }

  let sameAs = null;
  for (const p of previous) {
    if (p.fp && distance(fp, p.fp) < 0.18) {
      sameAs = p.angle;
      break;
    }
  }
  if (sameAs) issues.push("qSameAngle");

  const checks = [
    { id: "light", ok: !issues.includes("qTooDark") && !issues.includes("qTooBright") },
    { id: "sharp", ok: !issues.includes("qBlurry") },
    {
      id: "framed",
      ok: !["qNotVisible", "qMoveBack", "qMoveCloser", "qMoveLeft", "qMoveRight", "qCenter"].some((k) =>
        issues.includes(k),
      ),
    },
    { id: "new", ok: !sameAs },
  ];
  // Order of advice: what most ruins a reconstruction first.
  const priority = ["qTooDark", "qTooBright", "qNotVisible", "qBlurry", "qSameAngle", "qMoveBack",
    "qMoveCloser", "qMoveLeft", "qMoveRight", "qCenter"];
  const key = priority.find((k) => issues.includes(k)) || "qGood";
  return { level: key === "qGood" ? "good" : "warn", key, checks, fp, sameAs, frameKnown: fr.known };
}
