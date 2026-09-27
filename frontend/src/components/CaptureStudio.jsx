import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { t } from "../lib/i18n";
import { ANGLES } from "../lib/model3d";
import { analyse, fingerprint, sample } from "../lib/captureQuality";
import { Icon } from "./ui";

// Guided six-angle capture for a 3D product.
//
// One live camera session for all six views, not the camera app opened six
// times: the artisan sees which side is needed, an outline to fill, and live
// advice ("Move closer", "Good — capture now") before pressing the shutter.
// Each shot is checked again after capture; the artisan can always "Use
// anyway" — the checks advise, never block.
//
// If a live preview is impossible (permission refused, no camera, a page not
// served over https), each angle falls back to the phone's own camera app via
// <input capture>, with the same guidance and the same checks.

export const ANGLE_KEY = {
  front: "angFront", right: "angRight", back: "angBack", left: "angLeft", top: "angTop", bottom: "angBottom",
};
const HINT_KEY = {
  front: "angFrontHint", right: "angRightHint", back: "angBackHint",
  left: "angLeftHint", top: "angTopHint", bottom: "angBottomHint",
};
const CHECK_KEY = { light: "chkLight", sharp: "chkSharp", framed: "chkFramed", new: "chkNew" };
const MAX_SIDE = 1600;

/** Which way the artisan should turn the product — drawn, not described. */
export function AngleDiagram({ angle, size = 56, className = "" }) {
  const side = { front: 90, right: 0, back: 270, left: 180 }[angle];
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden="true">
      {side !== undefined ? (
        <>
          {/* top-down: the product disc. The amber arc is the side facing the
              phone (always toward it); the dot marks where the product's
              FRONT has turned to — so each side looks different. */}
          <circle cx="32" cy="30" r="16" fill="rgba(255,255,255,0.18)" stroke="currentColor" strokeWidth="2" />
          <path d="M 19.7 40.3 A 16 16 0 0 0 44.3 40.3" stroke="#e8a13a" strokeWidth="5" fill="none" strokeLinecap="round" />
          <circle
            cx={32 + 11 * Math.cos((side * Math.PI) / 180)}
            cy={30 + 11 * Math.sin((side * Math.PI) / 180)}
            r="3.5"
            fill="currentColor"
          />
          {/* phone, always "here" — the product turns, the phone stays */}
          <rect x="26" y="52" width="12" height="9" rx="2" fill="currentColor" />
        </>
      ) : angle === "top" ? (
        <>
          <rect x="18" y="36" width="28" height="18" rx="4" fill="rgba(255,255,255,0.18)" stroke="currentColor" strokeWidth="2" />
          <path d="M18 38 H46" stroke="#e8a13a" strokeWidth="5" strokeLinecap="round" />
          <rect x="26" y="6" width="12" height="9" rx="2" fill="currentColor" />
          <path d="M32 18 V30 M27 25 L32 30 L37 25" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <rect x="18" y="14" width="28" height="18" rx="4" fill="rgba(255,255,255,0.18)" stroke="currentColor" strokeWidth="2" transform="rotate(-18 32 23)" />
          <path d="M20 32 L44 24" stroke="#e8a13a" strokeWidth="5" strokeLinecap="round" />
          <rect x="26" y="50" width="12" height="9" rx="2" fill="currentColor" />
          <path d="M32 47 V37 M27 42 L32 37 L37 42" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

/** The six-side progress rail — shared by the camera, the status card and the tutorial. */
export function AngleRail({ lang, captures, current, onPick, compact = false, thumbs = {} }) {
  return (
    <ol className="flex gap-1 min-[360px]:gap-1.5 justify-center w-full" aria-label={t("cap3dTitle", lang)}>
      {ANGLES.map((a, i) => {
        const done = Boolean(captures?.[a]);
        const on = i === current;
        return (
          <li key={a} className="flex-1 min-w-0 max-w-[64px]">
            <button
              type="button"
              disabled={!onPick || (!done && !on)}
              onClick={() => onPick?.(i)}
              aria-current={on ? "step" : undefined}
              aria-label={`${t(ANGLE_KEY[a], lang)}${done ? " ✓" : ""}`}
              className={`relative w-full flex flex-col items-center justify-center rounded-xl border-2 px-0 transition ${
                compact ? "h-12" : "h-14"
              } ${on ? "border-haldi bg-white/15" : done ? "border-leaf/70 bg-white/10" : "border-white/20 bg-white/5"}`}
            >
              {thumbs[a] ? (
                <img src={thumbs[a]} alt="" className="absolute inset-0 w-full h-full object-cover rounded-[10px] opacity-60" />
              ) : null}
              {/* Angle names run long in Tamil/Telugu: let them wrap and
                  shrink inside a flexible chip instead of spilling over. */}
              <span className="relative max-w-full text-[8px] min-[360px]:text-[8.5px] font-extrabold tracking-tight leading-[1.1] text-white text-center break-words [overflow-wrap:anywhere]">
                {t(ANGLE_KEY[a], lang)}
              </span>
              {done && (
                <span className="relative mt-1 h-4 w-4 rounded-full bg-leaf text-white flex items-center justify-center">
                  <Icon name="check" size={11} strokeWidth={3.5} />
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

async function blobFromCanvas(canvas) {
  return new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.9));
}

async function frameToBlob(video) {
  const scale = Math.min(1, MAX_SIDE / Math.max(video.videoWidth, video.videoHeight));
  const c = document.createElement("canvas");
  c.width = Math.round(video.videoWidth * scale);
  c.height = Math.round(video.videoHeight * scale);
  c.getContext("2d").drawImage(video, 0, 0, c.width, c.height);
  return { blob: await blobFromCanvas(c), canvas: c };
}

async function fileToCanvas(file) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  return c;
}

export default function CaptureStudio({ lang, initial = {}, onPartial, onComplete, onClose, demo = null }) {
  // demo = {image, done}: the tutorial shows this exact screen with a sample
  // product and no camera — same layout, same words, nothing recorded.
  const [captures, setCaptures] = useState(() => ({ ...initial }));
  const [index, setIndex] = useState(() => {
    const i = ANGLES.findIndex((a) => !initial[a]);
    return i === -1 ? 0 : i;
  });
  const [camera, setCamera] = useState(demo ? "demo" : "starting"); // starting | live | fallback | demo
  const [camError, setCamError] = useState(null); // i18n key
  const [live, setLive] = useState(null); // analysis of the preview
  const [review, setReview] = useState(null); // {blob, url, result}
  const [busy, setBusy] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);
  const galleryRef = useRef(null);
  const fpsRef = useRef({}); // angle -> fingerprint of accepted shots

  const angle = ANGLES[demo ? Math.min(demo.done, 5) : index];
  const thumbs = useMemo(() => {
    const out = {};
    for (const a of ANGLES) if (captures[a]) out[a] = URL.createObjectURL(captures[a]);
    return out;
  }, [captures]);
  useEffect(() => () => Object.values(thumbs).forEach((u) => URL.revokeObjectURL(u)), [thumbs]);

  // Fingerprints for views restored from a saved draft, so "same side again"
  // still works after the app was closed mid-capture.
  useEffect(() => {
    (async () => {
      for (const a of ANGLES) {
        if (!initial[a] || fpsRef.current[a]) continue;
        try {
          const bmp = await createImageBitmap(initial[a]);
          fpsRef.current[a] = fingerprint(sample(bmp, bmp.width, bmp.height));
          bmp.close?.();
        } catch {}
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- camera lifecycle ----
  useEffect(() => {
    if (demo) return undefined;
    let cancelled = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
        setCamera("fallback");
        setCamError("capNoCamera");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1440 } },
          audio: false,
        });
        if (cancelled) return stream.getTracks().forEach((tr) => tr.stop());
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          await v.play().catch(() => {});
        }
        setCamera("live");
      } catch (e) {
        if (cancelled) return;
        setCamera("fallback");
        setCamError(e?.name === "NotAllowedError" || e?.name === "SecurityError" ? "capDenied" : "capNoCamera");
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
    };
  }, []);

  const previous = useCallback(
    (except) => ANGLES.filter((a) => a !== except && fpsRef.current[a]).map((a) => ({ angle: a, fp: fpsRef.current[a] })),
    [],
  );

  // ---- live advice while framing ----
  useEffect(() => {
    if (camera !== "live" || review) return undefined;
    const id = setInterval(() => {
      const v = videoRef.current;
      if (!v || !v.videoWidth) return;
      try {
        setLive(analyse(sample(v, v.videoWidth, v.videoHeight), previous(angle)));
      } catch {}
    }, 650);
    return () => clearInterval(id);
  }, [camera, review, angle, previous]);

  async function shoot() {
    const v = videoRef.current;
    if (!v?.videoWidth || busy) return;
    setBusy(true);
    try {
      const { blob, canvas } = await frameToBlob(v);
      const result = analyse(sample(canvas, canvas.width, canvas.height), previous(angle));
      setReview({ blob, url: URL.createObjectURL(blob), result });
    } finally {
      setBusy(false);
    }
  }

  async function fromFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const canvas = await fileToCanvas(file);
      const blob = await blobFromCanvas(canvas);
      const result = analyse(sample(canvas, canvas.width, canvas.height), previous(angle));
      setReview({ blob, url: URL.createObjectURL(blob), result });
    } catch {
      setCamError("capReadFailed");
    } finally {
      setBusy(false);
    }
  }

  function retake() {
    if (review) URL.revokeObjectURL(review.url);
    setReview(null);
    setLive(null);
  }

  function accept() {
    const next = { ...captures, [angle]: review.blob };
    fpsRef.current[angle] = review.result.fp;
    URL.revokeObjectURL(review.url);
    setReview(null);
    setLive(null);
    setCaptures(next);
    onPartial?.(next);
    const nextIndex = ANGLES.findIndex((a) => !next[a]);
    if (nextIndex === -1) {
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      onComplete(next);
    } else setIndex(nextIndex);
  }

  const advice = demo ? { level: "good", key: "qGood" } : review ? review.result : live;
  const railCaptures = demo ? Object.fromEntries(ANGLES.slice(0, demo.done).map((a) => [a, true])) : captures;
  const railThumbs = demo ? Object.fromEntries(ANGLES.slice(0, demo.done).map((a) => [a, demo.image])) : thumbs;
  const doneCount = ANGLES.filter((a) => railCaptures[a]).length;

  return (
    <div
      className="fixed sm:absolute inset-0 z-50 bg-ink text-white flex flex-col safe-top safe-bottom fade-in-fast"
      role="dialog"
      aria-modal="true"
      aria-label={t("cap3dTitle", lang)}
    >
      {/* header */}
      <div className="flex items-center gap-2 px-3 pt-3">
        <button
          onClick={() => onClose(captures)}
          aria-label={t("close", lang)}
          className="h-11 w-11 rounded-full flex items-center justify-center text-white/80 active:scale-90"
        >
          <Icon name="close" size={22} />
        </button>
        <div className="flex-1 min-w-0 text-center">
          <p className="text-[13px] font-semibold text-white/70 truncate">{t("cap3dTitle", lang)}</p>
          <p className="text-[11px] font-bold tracking-wide text-haldi" aria-live="polite">
            {t("capStepOf", lang).replace("{n}", ANGLES.indexOf(angle) + 1).replace("{total}", ANGLES.length)}
          </p>
        </div>
        <span className="h-11 w-11" aria-hidden="true" />
      </div>

      {/* which side, and how */}
      <div className="flex items-center gap-3 px-5 pt-2">
        <AngleDiagram angle={angle} className="text-white shrink-0" />
        <div className="min-w-0">
          <p className="text-3xl font-extrabold tracking-wide leading-none" data-tour="cap-angle">
            {t(ANGLE_KEY[angle], lang)}
          </p>
          <p className="text-sm text-white/75 mt-1.5 leading-snug">{t(HINT_KEY[angle], lang)}</p>
        </div>
      </div>

      {/* viewport */}
      <div className="relative flex-1 min-h-0 mx-3 mt-3 rounded-3xl overflow-hidden bg-black">
        {camera !== "fallback" && (
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className={`absolute inset-0 w-full h-full object-cover ${review ? "invisible" : ""}`}
          />
        )}
        {review && <img src={review.url} alt="" className="absolute inset-0 w-full h-full object-cover" />}
        {camera === "demo" && <img src={demo.image} alt="" className="absolute inset-0 w-full h-full object-cover" />}

        {camera === "fallback" && !review && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 gap-4">
            <AngleDiagram angle={angle} size={96} className="text-white/80" />
            <p className="text-sm text-white/80 leading-relaxed">{t(camError || "capNoCamera", lang)}</p>
            <button className="btn-primary !w-auto px-6" onClick={() => fileRef.current?.click()}>
              <Icon name="camera" size={20} /> {t("capOpenCamera", lang)}
            </button>
            <button className="min-h-[44px] text-sm font-semibold text-white/80 underline underline-offset-4" onClick={() => galleryRef.current?.click()}>
              {t("uploadPhoto", lang)}
            </button>
          </div>
        )}

        {camera === "starting" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-white/70">{t("capStarting", lang)}</p>
          </div>
        )}

        {/* outline to fill */}
        {(camera === "live" || camera === "demo") && !review && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
            <div
              className={`w-[64%] aspect-[3/4] max-h-[78%] rounded-[2rem] border-[3px] border-dashed transition-colors duration-300 ${
                advice?.level === "good" ? "border-leaf" : "border-white/70"
              }`}
              data-tour="cap-outline"
            />
          </div>
        )}

        {/* advice */}
        {advice && (camera === "live" || camera === "demo" || review) && (
          <div className="absolute left-3 right-3 bottom-3 flex justify-center" aria-live="polite">
            <span
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold shadow-soft ${
                advice.level === "good" ? "bg-leaf text-white" : "bg-haldi text-clay-900"
              }`}
            >
              <Icon name={advice.level === "good" ? "check" : "alert"} size={16} strokeWidth={2.5} />
              {t(advice.key, lang)}
            </span>
          </div>
        )}
      </div>

      {/* post-capture checklist */}
      {review && (
        <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 px-5 pt-3">
          {review.result.checks
            .filter((c) => c.id !== "framed" || review.result.frameKnown)
            .map((c) => (
              <li key={c.id} className="flex items-center gap-2 text-xs font-semibold">
                <span className={`h-5 w-5 rounded-full flex items-center justify-center ${c.ok ? "bg-leaf" : "bg-haldi text-clay-900"}`}>
                  <Icon name={c.ok ? "check" : "alert"} size={12} strokeWidth={3} />
                </span>
                <span className={c.ok ? "text-white/85" : "text-haldi"}>{t(CHECK_KEY[c.id], lang)}</span>
              </li>
            ))}
        </ul>
      )}

      {/* controls */}
      <div className="px-4 pt-3 pb-4">
        {review ? (
          <div className="grid grid-cols-2 gap-3">
            <button className="btn-ghost !border-white/30 !text-white" onClick={retake}>
              <Icon name="refresh" size={18} />
              {t("retake", lang)}
            </button>
            <button className="btn-primary" onClick={accept}>
              {review.result.level === "good" ? t("capUse", lang) : t("capUseAnyway", lang)}
            </button>
          </div>
        ) : (
          <>
            <div data-tour="cap-rail">
              <AngleRail
                lang={lang}
                captures={railCaptures}
                current={demo ? Math.min(demo.done, 5) : index}
                thumbs={railThumbs}
                onPick={demo ? undefined : (i) => setIndex(i)}
                compact
              />
            </div>
            <div className="mt-3 flex items-center justify-between">
              <button
                onClick={() => galleryRef.current?.click()}
                className="h-12 min-w-[48px] px-3 rounded-2xl border border-white/25 text-white/85 text-xs font-semibold flex items-center justify-center"
                aria-label={t("uploadPhoto", lang)}
              >
                <Icon name="image" size={20} />
              </button>
              {camera === "live" || camera === "demo" ? (
                <button
                  onClick={shoot}
                  disabled={busy}
                  aria-label={t("capShutter", lang)}
                  data-tour="cap-shutter"
                  className="h-[76px] w-[76px] rounded-full border-4 border-white flex items-center justify-center active:scale-95 transition disabled:opacity-50"
                >
                  <span className={`h-[60px] w-[60px] rounded-full ${advice?.level === "good" ? "bg-leaf" : "bg-white"}`} />
                </button>
              ) : (
                <span className="h-[76px]" />
              )}
              <span className="h-12 min-w-[48px] text-[11px] font-bold text-white/60 flex items-center justify-center">
                <span className="tabular-nums">{doneCount}/6</span>
              </span>
            </div>
          </>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={fromFile} />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={fromFile} />
    </div>
  );
}
