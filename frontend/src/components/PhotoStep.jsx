import React, { useRef, useState } from "react";
import { t } from "../lib/i18n";
import { enhanceImage, getLastSource } from "../lib/api";
import { Spinner } from "./ui";

export default function PhotoStep({ lang, onDone, setSource }) {
  // Two inputs, not one. `capture="environment"` is not a hint the user can
  // override — on Android it opens the camera and gives no route to the
  // gallery. An artisan who already photographed their work, or who is being
  // helped by someone with the photos on their phone, could not get past this
  // step at all. The gallery input is the same element without `capture`.
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // {original_b64, enhanced_b64, bg_removed, _demo}

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const r = await enhanceImage(file);
      setSource?.(getLastSource());
      setResult(r);
    } catch (err) {
      // Never leave the user staring at an empty step with no explanation:
      // that is what happened on Android when the fallback itself threw.
      console.error("photo step failed", err);
      setSource?.("demo");
    } finally {
      setBusy(false);
    }
  }

  const enhancedSrc = result && `data:image/png;base64,${result.enhanced_b64}`;
  const originalSrc = result && `data:image/png;base64,${result.original_b64}`;

  return (
    <div className="flex flex-col min-h-full px-4 sm:px-5 pb-8">
      <h2 className="text-2xl font-bold text-clay-900 mt-3">{t("addPhoto", lang)}</h2>

      {!result && !busy && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 fade-in">
          <div className="h-48 w-48 rounded-3xl border-4 border-dashed border-clay-300 flex items-center justify-center text-6xl">
            📷
          </div>
          <div className="w-full space-y-3">
            <button className="btn-primary !mt-0" onClick={() => cameraRef.current?.click()}>
              📷 {t("takePhoto", lang)}
            </button>
            <button className="btn-ghost !mt-0" onClick={() => galleryRef.current?.click()}>
              🖼️ {t("uploadPhoto", lang)}
            </button>
          </div>
        </div>
      )}

      {busy && <div className="flex-1 flex items-center justify-center"><Spinner label={t("enhancing", lang)} /></div>}

      {result && !busy && (
        <div className="flex-1 fade-in">
          <div className="grid grid-cols-2 gap-3 mt-5">
            <figure className="text-center">
              <img src={originalSrc} alt="before" className="rounded-2xl w-full aspect-square object-cover grayscale-[15%] opacity-90" />
              <figcaption className="text-xs text-clay-500 mt-1">{t("before", lang)}</figcaption>
            </figure>
            <figure className="text-center">
              <div className="rounded-2xl overflow-hidden ring-2 ring-clay-500">
                <img
                  src={enhancedSrc}
                  alt="after"
                  className={`w-full aspect-square object-cover ${result._demo ? "contrast-110 saturate-125 brightness-105" : ""}`}
                />
              </div>
              <figcaption className="text-xs text-clay-700 font-semibold mt-1">{t("after", lang)}</figcaption>
            </figure>
          </div>
          {result.bg_removed && (
            <p className="text-center text-leaf font-medium text-sm mt-3">{t("bgRemoved", lang)}</p>
          )}

          <div className="mt-6 space-y-3">
            <button className="btn-primary" onClick={() => onDone(result.enhanced_b64)}>
              {t("next", lang)} →
            </button>
            <div className="grid grid-cols-2 gap-3">
              <button className="btn-ghost !mt-0" onClick={() => cameraRef.current?.click()}>
                📷 {t("retake", lang)}
              </button>
              <button className="btn-ghost !mt-0" onClick={() => galleryRef.current?.click()}>
                🖼️ {t("uploadPhoto", lang)}
              </button>
            </div>
          </div>
        </div>
      )}

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}
