import React, { useEffect, useRef, useState } from "react";
import { t } from "../lib/i18n";
import { LOOKS, createProductVideo } from "../lib/productVideo";
import { shareFile, saveFile, fileNameFor } from "../lib/share";
import { Icon, Sheet, HelpLink } from "./ui";

// Photo → short product video, as a sheet over whatever screen opened it.
//
// The artisan sees four plain-language stages and the video being drawn live
// in the frame — it is literally rendering in front of them, so there is
// nothing to fake and the wait reads as progress, not a spinner. How it is
// made (canvas, MediaRecorder, codecs) never reaches the UI.
//
// The result is owned by App (onResult) so it survives closing this sheet and
// is offered again on the publish screen.

const LOOK_KEY = { zoom: "vidLookZoom", pan: "vidLookPan", spotlight: "vidLookSpot" };
const STAGES = [
  { id: "prepare", key: "vidStagePrep" },
  { id: "create", key: "vidStageCreate" },
  { id: "details", key: "vidStageDetails" },
  { id: "finalize", key: "vidStageFinal" },
];

function LookPicker({ look, setLook, lang, disabled }) {
  return (
    <div role="radiogroup" aria-label={t("vidLook", lang)} className="flex gap-2">
      {LOOKS.map((l) => {
        const on = look === l;
        return (
          <button
            key={l}
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => setLook(l)}
            className={`flex-1 min-h-[44px] rounded-2xl border-2 px-2 text-sm font-semibold transition active:scale-95 disabled:opacity-50 ${
              on ? "border-clay-600 bg-clay-600 text-white" : "border-clay-200 bg-white text-clay-800"
            }`}
          >
            {t(LOOK_KEY[l], lang)}
          </button>
        );
      })}
    </div>
  );
}

/** 9:16 frame that everything in the studio is shown inside. */
function Frame({ children, className = "" }) {
  return (
    <div
      className={`relative mx-auto aspect-[9/16] h-[min(46vh,420px)] rounded-[1.75rem] overflow-hidden bg-clay-900 shadow-soft ring-1 ring-black/5 ${className}`}
    >
      {children}
    </div>
  );
}

export default function VideoStudio({ lang, imageB64, details, existing, onResult, onClose, onHelp, shareText = "" }) {
  const [phase, setPhase] = useState(existing ? "done" : "idle"); // idle | rendering | done | error
  const [look, setLook] = useState(existing?.look || "zoom");
  const [stage, setStage] = useState("prepare");
  const [pct, setPct] = useState(0);
  const [notice, setNotice] = useState("");
  const [busyAction, setBusyAction] = useState(null);
  const canvasRef = useRef(null);
  const abortRef = useRef(null);

  const result = existing;
  const imageSrc = imageB64 ? `data:image/png;base64,${imageB64}` : null;

  // Leaving mid-render must stop the recorder, not leave it running unseen.
  useEffect(() => () => abortRef.current?.abort(), []);

  async function render(nextLook = look) {
    if (!imageSrc || phase === "rendering") return;
    setLook(nextLook);
    setNotice("");
    setStage("prepare");
    setPct(0);
    setPhase("rendering");
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    // Let React mount the <canvas> before drawing into it.
    await new Promise((r) => requestAnimationFrame(() => r()));
    try {
      const r = await createProductVideo({
        canvas: canvasRef.current,
        imageSrc,
        details,
        look: nextLook,
        signal: ctrl.signal,
        onProgress: ({ stage: s, pct: p }) => {
          setStage(s);
          setPct(p);
        },
      });
      onResult({ ...r, look: nextLook, hasDetails: Boolean(details?.title) });
      setPhase("done");
    } catch (e) {
      if (e?.name === "AbortError") return;
      console.error("product video failed", e);
      setPhase("error");
    }
  }

  const isVideo = result?.kind === "video";
  const blob = isVideo ? result.blob : result?.poster?.blob;
  const filename = fileNameFor(details?.title, isVideo ? result?.ext : "jpg");

  async function doShare() {
    if (!blob) return;
    setBusyAction("share");
    setNotice("");
    const r = await shareFile({ blob, filename, title: details?.title || "Karigar AI", text: shareText });
    if (r === "unsupported") {
      const s = await saveFile({ blob, filename });
      setNotice(s === "failed" ? t("vidActionFailed", lang) : t("vidShareFallback", lang));
    } else if (r === "failed") {
      setNotice(t("vidActionFailed", lang));
    }
    setBusyAction(null);
  }

  async function doSave() {
    if (!blob) return;
    setBusyAction("save");
    setNotice("");
    const r = await saveFile({ blob, filename, title: details?.title || "" });
    setNotice(
      r === "saved" ? t("vidSaved", lang) : r === "downloaded" ? t("vidDownloaded", lang) : r === "failed" ? t("vidActionFailed", lang) : "",
    );
    setBusyAction(null);
  }

  const nextLook = LOOKS[(LOOKS.indexOf(look) + 1) % LOOKS.length];
  const stageIdx = STAGES.findIndex((s) => s.id === stage);

  return (
    <Sheet onClose={onClose} label={t("vidCreate", lang)} closeLabel={t("close", lang)} tall>
      <div className="px-5 pt-3 pb-6">
        <div className="flex items-center gap-3 pr-10">
          <span className="h-11 w-11 rounded-2xl bg-clay-600 text-white flex items-center justify-center shrink-0">
            <Icon name="video" size={22} />
          </span>
          <div className="min-w-0">
            <h2 className="text-xl font-extrabold text-clay-900 leading-tight">
              {phase === "done" ? t(isVideo ? "vidReady" : "vidPosterT", lang) : t("vidCreate", lang)}
            </h2>
            {!(phase === "done" && !isVideo) && (
              <p className="text-xs text-clay-muted mt-0.5">{t("vidCreateSub", lang)}</p>
            )}
          </div>
        </div>

        {/* ---------------- idle: the empty state ---------------- */}
        {phase === "idle" && (
          <div className="fade-in">
            <Frame className="mt-5">
              {imageSrc && (
                <>
                  <img src={imageSrc} alt="" className="absolute inset-0 w-full h-full object-cover blur-2xl scale-125 opacity-70" />
                  <div className="absolute inset-0 bg-gradient-to-b from-clay-900/30 via-clay-900/40 to-clay-900/90" />
                  <img
                    src={imageSrc}
                    alt=""
                    className="absolute left-[8%] right-[8%] top-[11%] w-[84%] aspect-square object-cover rounded-2xl shadow-soft"
                  />
                </>
              )}
              {/* what the video will carry, shown as placeholders */}
              <div className="absolute left-[8%] right-[8%] bottom-[9%] space-y-2" aria-hidden="true">
                <div className="h-2 w-1/3 rounded bg-haldi/80" />
                <div className="h-3.5 w-11/12 rounded bg-white/85" />
                <div className="h-3.5 w-2/3 rounded bg-white/60" />
                <div className="flex gap-1.5 pt-1">
                  <div className="h-5 w-14 rounded-full bg-haldi" />
                  <div className="h-5 w-12 rounded-full bg-white/25" />
                </div>
              </div>
              <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
                <span className="h-16 w-16 rounded-full bg-white/90 text-clay-700 flex items-center justify-center shadow-soft">
                  <svg viewBox="0 0 24 24" className="h-7 w-7 ml-1" fill="currentColor"><path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14Z" /></svg>
                </span>
              </span>
            </Frame>

            <div className="text-center mt-5">
              <p className="font-bold text-clay-900">{t("vidEmptyT", lang)}</p>
              <p className="text-clay-600 text-sm mt-1 leading-snug px-2">{t("tpVideoB", lang)}</p>
            </div>

            <p className="text-xs font-bold tracking-wide text-clay-muted mt-5 mb-2">{t("vidLook", lang)}</p>
            <LookPicker look={look} setLook={setLook} lang={lang} />

            <button className="btn-primary mt-5" onClick={() => render(look)} disabled={!imageSrc}>
              <Icon name="sparkles" size={20} />
              {t("vidCreate", lang)}
            </button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-clay-muted">
              <Icon name="check" size={14} className="text-leaf" strokeWidth={3} />
              {t("tpVideoTip1", lang)}
            </p>
          </div>
        )}

        {/* ---------------- rendering: live frame + stages ---------------- */}
        {phase === "rendering" && (
          <div className="fade-in" aria-busy="true">
            <Frame className="mt-5">
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" aria-hidden="true" />
            </Frame>

            <div className="mt-5">
              <div
                className="relative h-2.5 rounded-full bg-clay-100 overflow-hidden"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(pct * 100)}
                aria-label={t(STAGES[Math.max(0, stageIdx)].key, lang)}
              >
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-clay-600 shimmer overflow-hidden transition-[width] duration-200 ease-out"
                  style={{ width: `${Math.max(4, pct * 100)}%` }}
                />
              </div>
              <ol className="mt-4 space-y-2.5" aria-live="polite">
                {STAGES.map((s, i) => {
                  const state = i < stageIdx ? "done" : i === stageIdx ? "active" : "todo";
                  return (
                    <li key={s.id} className="flex items-center gap-3 text-sm">
                      <span
                        className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${
                          state === "done" ? "bg-leaf text-white" : state === "active" ? "border-2 border-clay-600" : "border-2 border-clay-200"
                        }`}
                      >
                        {state === "done" ? (
                          <Icon name="check" size={14} strokeWidth={3} />
                        ) : state === "active" ? (
                          <span className="h-2.5 w-2.5 rounded-full bg-clay-600 animate-pulse" />
                        ) : null}
                      </span>
                      <span className={state === "todo" ? "text-clay-muted" : "text-clay-900 font-semibold"}>
                        {t(s.key, lang)}
                        {state === "active" && "…"}
                      </span>
                    </li>
                  );
                })}
              </ol>
              <p className="mt-4 text-xs text-clay-muted text-center">{t("vidKeepOpen", lang)}</p>
            </div>
          </div>
        )}

        {/* ---------------- done: preview + actions ---------------- */}
        {phase === "done" && result && (
          <div className="fade-in">
            <Frame className="mt-5">
              {isVideo ? (
                <video
                  key={result.url}
                  src={result.url}
                  poster={result.poster?.url}
                  className="absolute inset-0 w-full h-full object-cover"
                  controls
                  autoPlay
                  muted
                  loop
                  playsInline
                />
              ) : (
                <img src={result.poster.url} alt={details?.title || ""} className="absolute inset-0 w-full h-full object-cover" />
              )}
            </Frame>

            {!isVideo && (
              <p className="mt-4 text-sm text-clay-700 bg-haldi/15 border border-haldi/40 rounded-2xl px-4 py-3 leading-snug">
                {t("vidPosterB", lang)}
              </p>
            )}

            <button className="btn-primary mt-5" onClick={doShare} disabled={!!busyAction}>
              <Icon name="share" size={20} />
              {t(isVideo ? "vidShare" : "vidSharePicture", lang)}
            </button>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <button className="btn-ghost" onClick={doSave} disabled={!!busyAction}>
                <Icon name="download" size={18} />
                {t("vidSave", lang)}
              </button>
              <button className="btn-ghost" onClick={() => render(nextLook)} disabled={!!busyAction}>
                <Icon name="refresh" size={18} />
                {t("vidRegenerate", lang)}
              </button>
            </div>

            <p className="min-h-[1.5rem] mt-3 text-center text-sm font-medium text-clay-700" role="status" aria-live="polite">
              {notice}
            </p>

            <p className="text-xs font-bold tracking-wide text-clay-muted mt-2 mb-2">{t("vidLook", lang)}</p>
            <LookPicker look={look} setLook={(l) => render(l)} lang={lang} disabled={!!busyAction} />
          </div>
        )}

        {/* ---------------- error: recoverable ---------------- */}
        {phase === "error" && (
          <div className="fade-in text-center py-10">
            <span className="mx-auto h-14 w-14 rounded-full bg-haldi/20 text-clay-700 flex items-center justify-center">
              <Icon name="alert" size={28} />
            </span>
            <p className="font-bold text-clay-900 mt-4">{t("vidErrT", lang)}</p>
            <p className="text-clay-600 text-sm mt-1.5 px-4">{t("vidErrB", lang)}</p>
            <button className="btn-primary mt-6" onClick={() => render(look)}>
              <Icon name="refresh" size={20} />
              {t("tryAgain", lang)}
            </button>
          </div>
        )}

        {onHelp && phase !== "rendering" && (
          <div className="mt-2 flex justify-center">
            <HelpLink label={t("help", lang)} onClick={onHelp} />
          </div>
        )}
      </div>
    </Sheet>
  );
}

/**
 * The way into the studio from a flow screen. Before a video exists it is an
 * invitation (and says it's optional, so it never reads as a required step);
 * after, it shows the poster frame and offers to reopen it.
 */
export function VideoEntry({ lang, video, onOpen, needsDetails = false }) {
  const has = Boolean(video);
  return (
    <button
      onClick={onOpen}
      className="w-full card p-3 flex items-center gap-3 text-left active:scale-[0.98] transition"
    >
      {has ? (
        <span className="relative h-16 w-12 rounded-xl overflow-hidden bg-clay-900 shrink-0">
          <img src={video.poster?.url} alt="" className="w-full h-full object-cover" />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="h-6 w-6 rounded-full bg-white/90 text-clay-800 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="h-3 w-3 ml-0.5" fill="currentColor" aria-hidden="true"><path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14Z" /></svg>
            </span>
          </span>
        </span>
      ) : (
        <span className="h-12 w-12 rounded-2xl bg-clay-100 text-clay-700 flex items-center justify-center shrink-0">
          <Icon name="video" size={24} />
        </span>
      )}
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-2">
          <span className="font-bold text-clay-900 text-[15px] leading-tight truncate min-w-0">
            {t(has ? (video.kind === "video" ? "vidReady" : "vidPosterT") : "vidCreate", lang)}
          </span>
          {!has && (
            <span className="rounded-full bg-clay-100 px-2 py-0.5 text-[10px] font-bold text-clay-600 shrink-0">
              {t("optional", lang)}
            </span>
          )}
        </span>
        <span className="block text-xs text-clay-muted mt-0.5 leading-snug">
          {has ? t(needsDetails ? "vidAddDetails" : "vidTapToOpen", lang) : t("vidCreateSub", lang)}
        </span>
      </span>
      <Icon name="chevronRight" size={20} className="text-clay-muted" />
    </button>
  );
}
