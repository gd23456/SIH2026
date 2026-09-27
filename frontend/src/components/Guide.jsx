import React, { useState } from "react";
import { t } from "../lib/i18n";
import { Icon, Sheet } from "./ui";

// The guided workflow: one source of help content, shown three ways.
//
//   HelpSheet   — the "?" on each step: what this step is for, and tips.
//   GuideSheet  — "How Karigar AI works": the whole journey, with where you
//                 are, what's done, and a jump to any step you can reach.
//   (The first-run tour on the real screens lives in Tutorial.jsx.)
//
// Progressive disclosure: the tour says what the app does; the guide rows
// open to the detail only when tapped; the per-step "?" appears exactly where
// the question comes up. Nothing here is required to finish a listing.

export const TOPICS = {
  photo: { icon: "camera", title: "tpPhotoT", body: "tpPhotoB", tips: ["tpPhotoTip1", "tpPhotoTip2", "tpPhotoTip3"] },
  capture3d: { icon: "cube", title: "tpCaptureT", body: "tpCaptureB", tips: ["tpCaptureTip1", "tpCaptureTip2"] },
  speak: { icon: "mic", title: "tpSpeakT", body: "tpSpeakB", tips: ["tpSpeakTip1", "tpSpeakTip2"] },
  listing: { icon: "sparkles", title: "tpListT", body: "tpListB", tips: ["tpListTip1"] },
  gi: { icon: "tag", title: "tpGiT", body: "tpGiB", tips: ["tpGiTip1", "tpGiTip2"] },
  price: { icon: "scale", title: "tpPriceT", body: "tpPriceB", tips: ["tpPriceTip1", "tpPriceTip2"] },
  publish: { icon: "send", title: "tpPublishT", body: "tpPublishB", tips: [] },
  video: { icon: "video", title: "tpVideoT", body: "tpVideoB", tips: ["tpVideoTip1", "tpVideoTip2"] },
  qr: { icon: "qr", title: "tpQrT", body: "tpQrB", tips: ["tpQrTip1", "tpQrTip2"] },
};

/** The help topic for each step of the 5-step selling flow. */
export const STEP_TOPIC = { 1: "photo", 2: "speak", 3: "listing", 4: "price", 5: "publish" };

// The journey in the order an artisan lives it. `step` is the flow step that
// row belongs to; video and QR live outside the numbered flow.
export const JOURNEY = [
  { topic: "photo", step: 1 },
  { topic: "capture3d", step: 1 },
  { topic: "speak", step: 2 },
  { topic: "listing", step: 3 },
  { topic: "gi", step: 3 },
  { topic: "price", step: 4 },
  { topic: "publish", step: 5 },
  { topic: "video", needs: "image" },
  { topic: "qr", needs: "nothing" },
];

function Tips({ keys, lang }) {
  if (!keys?.length) return null;
  return (
    <ul className="mt-4 space-y-2.5">
      {keys.map((k) => (
        <li key={k} className="flex items-start gap-3 text-[15px] leading-snug text-clay-800">
          <span className="mt-0.5 h-6 w-6 rounded-full bg-leaf/15 text-leaf flex items-center justify-center shrink-0">
            <Icon name="check" size={14} strokeWidth={3} />
          </span>
          {t(k, lang)}
        </li>
      ))}
    </ul>
  );
}

// ------------------------------------------------------------- HelpSheet ---

export function HelpSheet({ topic, lang, onClose, onJourney }) {
  const tp = TOPICS[topic];
  if (!tp) return null;
  return (
    <Sheet onClose={onClose} label={t(tp.title, lang)} closeLabel={t("close", lang)}>
      <div className="px-6 pt-4 pb-6">
        <div className="h-14 w-14 rounded-2xl bg-clay-100 text-clay-700 flex items-center justify-center">
          <Icon name={tp.icon} size={28} />
        </div>
        <h3 className="mt-4 text-xl font-extrabold text-clay-900 leading-snug pr-8">{t(tp.title, lang)}</h3>
        <p className="mt-2 text-clay-700 text-[15px] leading-relaxed">{t(tp.body, lang)}</p>
        <Tips keys={tp.tips} lang={lang} />
        <button className="btn-primary mt-6" onClick={onClose}>
          {t("gotIt", lang)}
        </button>
        {onJourney && (
          <button
            onClick={onJourney}
            className="w-full mt-2 min-h-[44px] flex items-center justify-center gap-2 text-sm font-semibold text-clay-600"
          >
            <Icon name="book" size={16} />
            {t("seeJourney", lang)}
          </button>
        )}
      </div>
    </Sheet>
  );
}

// ------------------------------------------------------------ GuideSheet ---

/**
 * @param {object} progress  {step, furthest, hasImage} — step is the current
 *   flow step (0 = not selling), furthest the highest step reached for the
 *   listing in progress.
 * @param {Function} onGo    (row) => void — App decides what "go" means.
 */
export function GuideSheet({ lang, progress, onGo, onClose, onReplayTour, onStart }) {
  const { step, furthest, hasImage, locked, canStart } = progress;
  const [open, setOpen] = useState(() => {
    // Open the row you're on, so the guide answers "what now?" immediately.
    const i = JOURNEY.findIndex((r) => r.step === step);
    return i >= 0 ? i : null;
  });

  function status(row) {
    if (row.needs === "nothing") return { reachable: true };
    if (row.needs === "image") return { reachable: hasImage };
    // gi shares step 3 with listing, and capture3d shares step 1 with photo
    const current = step === row.step && row.topic !== "gi" && row.topic !== "capture3d";
    const done = furthest > row.step && step !== row.step;
    const reachable = locked ? row.step === 5 : row.step === 1 || row.step <= furthest;
    return { current, done, reachable };
  }

  return (
    <Sheet onClose={onClose} label={t("helpHow", lang)} closeLabel={t("close", lang)} tall>
      <div className="px-5 pt-3 pb-6">
        <h2 className="text-2xl font-extrabold text-clay-900 pr-10">{t("helpHow", lang)}</h2>
        <p className="text-clay-600 text-sm mt-1.5 leading-snug">{t("helpHowSub", lang)}</p>

        <ol className="mt-5 relative">
          {JOURNEY.map((row, i) => {
            const tp = TOPICS[row.topic];
            const st = status(row);
            const expanded = open === i;
            const last = i === JOURNEY.length - 1;
            return (
              <li key={row.topic} className="relative pl-14 rise" style={{ animationDelay: `${i * 40}ms` }}>
                {/* rail */}
                {!last && (
                  <span
                    className={`absolute left-[21px] top-11 bottom-0 w-0.5 ${st.done ? "bg-clay-500" : "bg-clay-200"}`}
                    aria-hidden="true"
                  />
                )}
                {/* node */}
                <span
                  className={`absolute left-0 top-1 h-11 w-11 rounded-full flex items-center justify-center text-lg border-2 ${
                    st.current
                      ? "bg-clay-600 border-clay-600 text-white shadow-soft"
                      : st.done
                        ? "bg-clay-100 border-clay-500 text-clay-700"
                        : "bg-white border-clay-200"
                  }`}
                  aria-hidden="true"
                >
                  <Icon name={st.done ? "check" : tp.icon} size={18} strokeWidth={st.done ? 3 : 2} />
                </span>

                <button
                  onClick={() => setOpen(expanded ? null : i)}
                  aria-expanded={expanded}
                  className="w-full text-left min-h-[52px] pb-3 pt-1.5 flex items-start gap-2"
                >
                  <span className="flex-1 min-w-0">
                    <span className="block text-[11px] font-bold tracking-wide text-clay-muted">{i + 1}</span>
                    <span className="block font-bold text-clay-900 leading-snug">{t(tp.title, lang)}</span>
                    {st.current && (
                      <span className="inline-flex mt-1 rounded-full bg-clay-600 text-white px-2 py-0.5 text-[11px] font-bold">
                        {t("youAreHere", lang)}
                      </span>
                    )}
                  </span>
                  <Icon
                    name="chevronDown"
                    size={18}
                    className={`mt-5 text-clay-muted transition-transform ${expanded ? "rotate-180" : ""}`}
                  />
                </button>

                {expanded && (
                  <div className="pb-5 fade-in">
                    <p className="text-clay-700 text-sm leading-relaxed">{t(tp.body, lang)}</p>
                    <Tips keys={tp.tips} lang={lang} />
                    {st.reachable ? (
                      !st.current && (
                        <button
                          onClick={() => onGo(row)}
                          className="mt-4 inline-flex items-center gap-1.5 min-h-[44px] rounded-full bg-clay-600 text-white px-5 text-sm font-bold active:scale-95 transition"
                        >
                          {t("goThere", lang)}
                          <Icon name="chevronRight" size={16} />
                        </button>
                      )
                    ) : (
                      <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-clay-muted">
                        <Icon name="lock" size={14} />
                        {t("lockedStep", lang)}
                      </p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>

        <div className="mt-4 space-y-2">
          {canStart && onStart && (
            <button className="btn-primary" onClick={onStart}>
              <Icon name="camera" size={20} /> {t("addProduct", lang)}
            </button>
          )}
          <button className="btn-ghost" onClick={onReplayTour}>
            <Icon name="sparkles" size={18} />
            {t("replayTour", lang)}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
