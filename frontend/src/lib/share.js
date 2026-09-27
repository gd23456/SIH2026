// Share / save a generated file (the product video, or its product card).
//
// The Android APK needs its own path: Capacitor's WebView implements neither
// navigator.share nor <a download> — both are silently ignored, which is the
// same class of bug openExternal() in api.js exists for. On a device the file
// is written to app storage with @capacitor/filesystem and handed to the
// system share sheet with @capacitor/share. In a browser the Web Share API is
// used where it can take files, and a plain download otherwise.
//
// Every function resolves to a status string instead of throwing, so the UI
// can always tell the artisan what actually happened.

import { isNativeApp } from "./api";

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] || "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

const isCancel = (e) => /cancel|abort/i.test(String(e?.name || "") + String(e?.message || e || ""));

async function nativeWrite(blob, filename, directoryName) {
  const { Filesystem, Directory } = await import("@capacitor/filesystem");
  const data = await blobToBase64(blob);
  const { uri } = await Filesystem.writeFile({
    path: directoryName === "Documents" ? `Karigar/${filename}` : filename,
    data,
    directory: Directory[directoryName],
    recursive: true,
  });
  return uri;
}

/**
 * Open the share sheet with the file attached.
 * @returns {Promise<"shared"|"cancelled"|"unsupported"|"failed">}
 */
export async function shareFile({ blob, filename, title = "", text = "" }) {
  if (isNativeApp()) {
    try {
      const uri = await nativeWrite(blob, filename, "Cache");
      const { Share } = await import("@capacitor/share");
      await Share.share({ title, text, files: [uri], dialogTitle: title });
      return "shared";
    } catch (e) {
      if (isCancel(e)) return "cancelled";
      console.warn("native share failed", e);
      return "failed";
    }
  }
  try {
    const file = new File([blob], filename, { type: blob.type });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title, text });
      return "shared";
    }
    return "unsupported";
  } catch (e) {
    if (isCancel(e)) return "cancelled";
    console.warn("web share failed", e);
    return "failed";
  }
}

/**
 * Keep a copy on the device.
 * @returns {Promise<"saved"|"downloaded"|"shared"|"cancelled"|"failed">}
 *   "shared" means saving to Documents was refused and the share sheet was
 *   offered instead — from it the artisan can still pick Files / Drive.
 */
export async function saveFile({ blob, filename, title = "" }) {
  if (isNativeApp()) {
    try {
      await nativeWrite(blob, filename, "Documents");
      return "saved";
    } catch (e) {
      console.warn("save to Documents failed; offering share sheet", e);
      const r = await shareFile({ blob, filename, title });
      return r === "shared" ? "shared" : r === "cancelled" ? "cancelled" : "failed";
    }
  }
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return "downloaded";
  } catch (e) {
    console.warn("download failed", e);
    return "failed";
  }
}

/** A filesystem-safe file name from a product title. */
export function fileNameFor(title, ext) {
  const slug = String(title || "product")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `karigar-${slug || "product"}.${ext}`;
}
