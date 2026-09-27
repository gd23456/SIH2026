import React, { useEffect, useRef, useState } from "react";
import { t } from "../lib/i18n";
import { Icon } from "./ui";

// The 3D view of a product, and the card that tracks its creation.
//
// Viewer: Google's <model-viewer> (WebGL via three.js). Chosen over a
// hand-rolled three.js scene because it already does what a buyer's phone
// needs — touch orbit/pinch/pan, mouse + keyboard, progressive GLB loading,
// sensible lighting, and AR where the phone supports it. Loaded on first use
// only; it is ~1 MB the app shell shouldn't pay for up front.

let viewerLib = null;
function loadViewer() {
  if (!viewerLib) viewerLib = import("@google/model-viewer");
  return viewerLib;
}

export function ModelViewer3D({ src, alt, lang, isTest = false, className = "" }) {
  const boxRef = useRef(null);
  const mvRef = useRef(null);
  const [ready, setReady] = useState(false); // library loaded
  const [state, setState] = useState("loading"); // loading | shown | error
  const [pct, setPct] = useState(0);

  useEffect(() => {
    let alive = true;
    loadViewer()
      .then(() => alive && setReady(true))
      .catch(() => alive && setState("error"));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const mv = mvRef.current;
    if (!ready || !mv) return undefined;
    const onLoad = () => setState("shown");
    const onError = () => setState("error");
    const onProgress = (e) => setPct(e.detail?.totalProgress || 0);
    mv.addEventListener("load", onLoad);
    mv.addEventListener("error", onError);
    mv.addEventListener("progress", onProgress);
    return () => {
      mv.removeEventListener("load", onLoad);
      mv.removeEventListener("error", onError);
      mv.removeEventListener("progress", onProgress);
    };
  }, [ready, src]);

  function reset() {
    const mv = mvRef.current;
    if (!mv) return;
    mv.cameraOrbit = "auto auto auto";
    mv.cameraTarget = "auto auto auto";
    mv.fieldOfView = "auto";
    mv.jumpCameraToGoal?.();
  }

  function zoom(factor) {
    const mv = mvRef.current;
    const o = mv?.getCameraOrbit?.();
    if (!o) return;
    mv.cameraOrbit = `${o.theta}rad ${o.phi}rad ${o.radius * factor}m`;
  }

  function fullscreen() {
    const el = boxRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else el.requestFullscreen?.().catch(() => {});
  }

  return (
    <div
      ref={boxRef}
      className={`relative w-full aspect-square rounded-2xl overflow-hidden bg-[radial-gradient(circle_at_50%_40%,theme(colors.white),theme(colors.stage))] ${className}`}
    >
      {ready && (
        <model-viewer
          ref={mvRef}
          src={src}
          alt={alt}
          camera-controls=""
          touch-action="pan-y"
          shadow-intensity="0.8"
          interaction-prompt="auto"
          ar=""
          style={{ width: "100%", height: "100%", "--poster-color": "transparent" }}
        />
      )}

      {state === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
          <div className="h-10 w-10 rounded-full border-4 border-clay-200 border-t-clay-600 animate-spin" />
          <p className="text-sm font-medium text-clay-700">
            {t("vwLoading", lang)} {pct > 0 ? `${Math.round(pct * 100)}%` : ""}
          </p>
        </div>
      )}
      {state === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-6">
          <Icon name="alert" size={28} className="text-clay-600" />
          <p className="text-sm font-semibold text-clay-800">{t("vwError", lang)}</p>
        </div>
      )}

      {isTest && (
        <span className="absolute left-3 top-3 rounded-full bg-haldi px-2.5 py-1 text-[11px] font-bold text-clay-900">
          {t("m3dTestModel", lang)}
        </span>
      )}

      {state === "shown" && (
        <>
          <div className="absolute right-2 top-2 flex flex-col gap-2">
            <ToolButton label={t("vwFull", lang)} onClick={fullscreen}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" /></svg>
            </ToolButton>
            <ToolButton label={t("vwZoomIn", lang)} onClick={() => zoom(0.8)}>
              <span className="text-lg font-bold leading-none">+</span>
            </ToolButton>
            <ToolButton label={t("vwZoomOut", lang)} onClick={() => zoom(1.25)}>
              <span className="text-lg font-bold leading-none">−</span>
            </ToolButton>
            <ToolButton label={t("vwReset", lang)} onClick={reset}>
              <Icon name="refresh" size={18} />
            </ToolButton>
          </div>
          {/* right padding clears model-viewer's own AR button (bottom-right) */}
          <p className="absolute left-3 right-16 bottom-3 text-[11px] font-medium text-clay-600 pointer-events-none leading-snug">
            {t("vwHint", lang)}
          </p>
        </>
      )}
    </div>
  );
}

function ToolButton({ label, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="h-11 w-11 rounded-xl bg-white/90 border border-clay-100 text-clay-800 shadow-soft flex items-center justify-center active:scale-90 transition"
    >
      {children}
    </button>
  );
}

// ------------------------------------------------------------ status card ---

function Row({ state, children }) {
  // state: done | active | todo | error | waiting
  const dot = {
    done: <span className="h-6 w-6 rounded-full bg-leaf text-white flex items-center justify-center"><Icon name="check" size={14} strokeWidth={3} /></span>,
    active: <span className="h-6 w-6 rounded-full border-2 border-clay-600 flex items-center justify-center"><span className="h-2.5 w-2.5 rounded-full bg-clay-600 animate-pulse" /></span>,
    waiting: <span className="h-6 w-6 rounded-full border-2 border-dashed border-haldi" />,
    error: <span className="h-6 w-6 rounded-full bg-red-100 text-red-700 flex items-center justify-center"><Icon name="close" size={14} strokeWidth={3} /></span>,
    todo: <span className="h-6 w-6 rounded-full border-2 border-clay-200" />,
  }[state];
  return (
    <li className="flex items-center gap-3 text-sm">
      <span className="shrink-0">{dot}</span>
      <span className={state === "todo" ? "text-clay-muted" : "text-clay-900 font-semibold"}>{children}</span>
    </li>
  );
}

/**
 * What is happening to this product's 3D view, in the artisan's words.
 * @param model  state from lib/model3d (phase, uploadPct, …) or null
 */
export function Model3DCard({ lang, model, onView, onRetry, onSkip, compact = false, bare = false }) {
  // bare: no card of its own, for when it sits inside another card.
  const shell = bare ? "border-t border-clay-100 pt-3" : "card p-4";
  if (!model) return null;
  const p = model.phase;
  const uploaded = Boolean(model.jobId);
  const building = p === "queued" || p === "processing";

  if (model.skipped) {
    return (
      <div className={`${shell} flex items-center gap-3`}>
        <Icon name="cube" size={24} className="text-clay-600" />
        <p className="flex-1 text-sm text-clay-600">{t("m3dSkipped", lang)}</p>
        <button onClick={onRetry} className="min-h-[44px] px-3 text-sm font-bold text-clay-700">
          {t("tryAgain", lang)}
        </button>
      </div>
    );
  }

  return (
    <div className={shell} aria-live="polite" data-tour="model-card">
      <div className="flex items-center gap-2">
        <span className="h-9 w-9 rounded-xl bg-clay-100 text-clay-700 flex items-center justify-center" aria-hidden="true"><Icon name="cube" size={20} /></span>
        <p className="font-bold text-clay-900 flex-1">
          {p === "ready" ? t("m3dReady", lang) : p === "failed" ? t("m3dFailed", lang) : t("m3dCreating", lang)}
        </p>
        {model.isTest && p === "ready" && (
          <span className="rounded-full bg-haldi/25 px-2 py-0.5 text-[10px] font-bold text-clay-800">{t("m3dTestModel", lang)}</span>
        )}
      </div>

      {!compact && p !== "ready" && (
        <ol className="mt-3 space-y-2.5">
          <Row state="done">{t("m3dCaptured", lang)}</Row>
          <Row state={uploaded ? "done" : p === "uploading" ? "active" : p === "failed" ? "error" : "waiting"}>
            {p === "uploading"
              ? t("m3dUploading", lang).replace("{pct}", Math.round((model.uploadPct || 0) * 100))
              : t("m3dUploaded", lang)}
          </Row>
          <Row state={uploaded ? "done" : "todo"}>{t("m3dProcessed", lang)}</Row>
          <Row state={p === "failed" && uploaded ? "error" : building ? "active" : p === "unavailable" ? "waiting" : "todo"}>
            {t("m3dBuilding", lang)}
          </Row>
        </ol>
      )}

      {building && <p className="mt-3 text-xs text-clay-600 leading-snug">{t("m3dWait", lang)}</p>}
      {(p === "saved" || p === "offline") && (
        <p className="mt-3 text-xs text-clay-700 bg-haldi/15 rounded-xl px-3 py-2 leading-snug">{t("m3dOffline", lang)}</p>
      )}
      {p === "unavailable" && (
        <p className="mt-3 text-xs text-clay-700 bg-haldi/15 rounded-xl px-3 py-2 leading-snug">{t("m3dUnavailable", lang)}</p>
      )}

      {p === "ready" && (
        <button className="btn-primary mt-3 !py-3 !text-base" onClick={onView}>
          <Icon name="cube" size={20} /> {t("m3dView", lang)}
        </button>
      )}
      {(p === "failed" || p === "unavailable") && (
        <div className="flex flex-col gap-2 mt-3">
          <button className="btn-ghost !py-2.5 !text-sm" onClick={onRetry}>
            <Icon name="refresh" size={16} />
            {t("tryAgain", lang)}
          </button>
          <button className="btn-ghost !py-2.5 !text-sm" onClick={onSkip}>
            {t("m3dContinue", lang)}
          </button>
        </div>
      )}
    </div>
  );
}
