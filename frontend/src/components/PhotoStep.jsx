import React, { useEffect, useRef, useState } from "react";
import { t } from "../lib/i18n";
import { enhanceImage, getLastSource } from "../lib/api";
import { ANGLES } from "../lib/model3d";
import { Spinner, Icon } from "./ui";
import { VideoEntry } from "./VideoStudio";
import { Model3DCard } from "./Model3D";
import { ANGLE_KEY } from "./CaptureStudio";

// Step 1: the product's photos.
//
// Default path: the guided six-side capture, which yields the 3D view AND the
// main catalogue photo (the FRONT shot, background-cleaned). "Just one photo"
// stays for things six sides make no sense for — a saree has no bottom.

export default function PhotoStep({
  lang, onDone, setSource, onVideo, video,
  imageB64, model, captureThumbs = {}, frontFile, onStart3D, onModel3D,
}) {
  // Two inputs, not one. `capture="environment"` is not a hint the user can
  // override — on Android it opens the camera and gives no route to the
  // gallery. The gallery input is the same element without `capture`.
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const [busy, setBusy] = useState(false);
  // {original_b64, enhanced_b64, bg_removed, _demo} — seeded from a resumed draft.
  const [result, setResult] = useState(() =>
    imageB64 ? { original_b64: imageB64, enhanced_b64: imageB64, bg_removed: false, restored: true } : null,
  );

  async function handleFile(file) {
    if (!file) return;
    setBusy(true);
    try {
      const r = await enhanceImage(file);
      setSource?.(getLastSource());
      setResult(r);
    } catch (err) {
      // Never leave the user staring at an empty step with no explanation.
      console.error("photo step failed", err);
      setSource?.("demo");
    } finally {
      setBusy(false);
    }
  }

  // The 3D capture's FRONT view becomes the catalogue photo.
  useEffect(() => {
    if (frontFile) handleFile(frontFile);
  }, [frontFile]); // eslint-disable-line react-hooks/exhaustive-deps

  const enhancedSrc = result && `data:image/png;base64,${result.enhanced_b64}`;
  const originalSrc = result && `data:image/png;base64,${result.original_b64}`;
  const has3d = Boolean(model);

  return (
    <div className="flex flex-col min-h-full px-4 sm:px-5 pb-8">
      <h2 className="text-2xl font-bold text-clay-900 mt-3">{t("addPhoto", lang)}</h2>

      {!result && !busy && (
        <div className="flex-1 flex flex-col gap-4 mt-4 fade-in">
          {/* the recommended path */}
          <div className="rounded-3xl bg-clay-900 text-white p-5 shadow-soft">
            <div className="flex items-center gap-3">
              <span className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center" aria-hidden="true"><Icon name="cube" size={26} /></span>
              <div className="min-w-0">
                <p className="text-lg font-extrabold leading-tight">{t("photo3dTitle", lang)}</p>
                <p className="text-sm text-white/75 leading-snug mt-0.5">{t("photo3dSub", lang)}</p>
              </div>
            </div>
            <ol className="mt-4 grid grid-cols-6 gap-1" aria-hidden="true">
              {ANGLES.map((a) => (
                <li key={a} className="rounded-lg bg-white/10 py-1.5 text-center text-[9px] font-extrabold tracking-wide">
                  {t(ANGLE_KEY[a], lang)}
                </li>
              ))}
            </ol>
            <button className="btn-primary mt-4 !bg-haldi !text-clay-900" onClick={onStart3D} data-tour="start-3d">
              <Icon name="camera" size={20} /> <span className="truncate">{t("photo3dStart", lang)}</span>
            </button>
          </div>

          {/* photo tips — the one moment they can still change the result */}
          <div className="w-full rounded-2xl bg-white border border-clay-100 px-4 py-3.5">
            <p className="flex items-center gap-2 text-sm font-bold text-clay-900">
              <Icon name="bulb" size={18} className="text-haldi" />
              {t("tipsTitle", lang)}
            </p>
            <ul className="mt-2 space-y-1.5">
              {[["sun", "tpPhotoTip1"], ["frame", "tpPhotoTip2"], ["image", "tpPhotoTip3"]].map(([ic, k]) => (
                <li key={k} className="flex items-center gap-2.5 text-[14px] text-clay-700">
                  <Icon name={ic} size={18} className="text-clay-600" />
                  {t(k, lang)}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-bold text-clay-muted mb-2">{t("photoOneTitle", lang)}</p>
            <div className="flex flex-col gap-2">
              <button className="btn-ghost !mt-0 !text-sm whitespace-nowrap" onClick={() => cameraRef.current?.click()}>
                <Icon name="camera" size={18} /> {t("takePhoto", lang)}
              </button>
              <button className="btn-ghost !mt-0 !text-sm whitespace-nowrap" onClick={() => galleryRef.current?.click()}>
                <Icon name="image" size={18} /> {t("uploadPhoto", lang)}
              </button>
            </div>
          </div>
        </div>
      )}

      {busy && (
        <div className="flex-1 flex items-center justify-center">
          <Spinner label={t("enhancing", lang)} />
        </div>
      )}

      {result && !busy && (
        <div className="flex-1 fade-in">
          {result.restored ? (
            <img src={enhancedSrc} alt="" className="mt-5 rounded-2xl w-full aspect-[4/3] object-cover ring-2 ring-clay-500" />
          ) : (
            <div className="grid grid-cols-2 gap-3 mt-5">
              <figure className="text-center">
                <img src={originalSrc} alt={t("before", lang)} className="rounded-2xl w-full aspect-square object-cover grayscale-[15%] opacity-90" />
                <figcaption className="text-xs text-clay-muted mt-1">{t("before", lang)}</figcaption>
              </figure>
              <figure className="text-center">
                <div className="rounded-2xl overflow-hidden ring-2 ring-clay-500">
                  <img
                    src={enhancedSrc}
                    alt={t("after", lang)}
                    className={`w-full aspect-square object-cover ${result._demo ? "contrast-110 saturate-125 brightness-105" : ""}`}
                  />
                </div>
                <figcaption className="text-xs text-clay-700 font-semibold mt-1">{t("after", lang)}</figcaption>
              </figure>
            </div>
          )}
          {result.bg_removed && (
            <p className="text-center text-leaf font-medium text-sm mt-3">{t("bgRemoved", lang)}</p>
          )}

          {has3d && (
            <>
              <div className="mt-4 flex gap-1.5 overflow-x-auto" aria-label={t("cap3dTitle", lang)}>
                {ANGLES.map((a) =>
                  captureThumbs[a] ? (
                    <figure key={a} className="shrink-0 text-center">
                      <img src={captureThumbs[a]} alt={t(ANGLE_KEY[a], lang)} className="h-14 w-14 rounded-xl object-cover" />
                      <figcaption className="text-[9px] font-bold text-clay-muted mt-0.5">{t(ANGLE_KEY[a], lang)}</figcaption>
                    </figure>
                  ) : null,
                )}
              </div>
              <div className="mt-3">
                <Model3DCard lang={lang} model={model} {...onModel3D} />
              </div>
            </>
          )}

          {onVideo && (
            <div className="mt-4">
              <VideoEntry
                lang={lang}
                video={video?.imageKey === result.enhanced_b64 ? video : null}
                onOpen={() => onVideo(result.enhanced_b64)}
              />
            </div>
          )}

          <div className="mt-5 space-y-3">
            <button className="btn-primary" onClick={() => onDone(result.enhanced_b64)}>
              {t("photoNext", lang)} →
            </button>
            {!has3d && (
              <div className="flex flex-col gap-2">
                <button className="btn-ghost !mt-0 whitespace-nowrap" onClick={() => cameraRef.current?.click()}>
                  <Icon name="camera" size={18} /> {t("retake", lang)}
                </button>
                <button className="btn-ghost !mt-0 whitespace-nowrap" onClick={() => galleryRef.current?.click()}>
                  <Icon name="image" size={18} /> {t("uploadPhoto", lang)}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
