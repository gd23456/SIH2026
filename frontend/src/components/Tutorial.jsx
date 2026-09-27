import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { LANGS, t } from "../lib/i18n";
import { demoListing, demoPrice } from "../lib/demoData";
import { fileToB64 } from "../lib/api";
import Welcome from "./Welcome";
import PhotoStep from "./PhotoStep";
import CaptureStudio from "./CaptureStudio";
import VoiceStep from "./VoiceStep";
import ReviewStep from "./ReviewStep";
import PriceStep from "./PriceStep";
import PublishStep from "./PublishStep";
import { Header, Stepper, LanguageSheet, Icon } from "./ui";

// The first-run tutorial — on the app's REAL screens.
//
// Each step mounts the actual component the artisan will use (the same JSX,
// styles and words), fills it with a sample product, and puts a spotlight on
// the real control with a pointer and an explanation. Nothing here is a
// screenshot or an illustration, so the tour can never drift out of date
// with the UI: change a screen and the tour shows the change.
//
// The screens are inert (no taps reach them); only the tour's own controls
// work. Changing language re-renders both the screen and the bubble.

const SAMPLE_IMG = "/demo/channapatna.jpg"; // bundled: the tour works offline

const STEPS = [
  { screen: "home", target: "sell-cta", title: "tutSellT", body: "tutSellB" },
  { screen: "home", target: "lang-chip", title: "tutLangT", body: "tutLangB" },
  { screen: "photo", target: "start-3d", title: "tpCaptureT", body: "tutCaptureB", flow: 1 },
  { screen: "capture", target: "cap-rail", title: "tutAnglesT", body: "tutAnglesB", ticks: true },
  { screen: "capture", target: "cap-shutter", title: "tutShutterT", body: "tutShutterB" },
  { screen: "voice", target: "voice-mic", title: "tpSpeakT", body: "tutSpeakB", flow: 2 },
  { screen: "review", target: "review-edit", title: "tutEditT", body: "tutEditB", flow: 3 },
  { screen: "review", target: "gi-badge", title: "tpGiT", body: "tutGiB", flow: 3 },
  { screen: "price", target: "price-hero", title: "tpPriceT", body: "tutPriceB", flow: 4 },
  { screen: "final", target: "publish-btn", title: "tutPublishT", body: "tutPublishB", flow: 5 },
  { screen: "final", target: "video-entry", title: "tutShareT", body: "tutShareB", flow: 5 },
];

const noop = () => {};
const PAD = 8;

function Stage({ step, lang, account, sample }) {
  const [ticks, setTicks] = useState(0);
  // The six-sides step animates the rail filling FRONT → BOTTOM, on a loop.
  useEffect(() => {
    if (!step.ticks) return undefined;
    setTicks(0);
    const id = setInterval(() => setTicks((n) => (n >= 6 ? 0 : n + 1)), 700);
    return () => clearInterval(id);
  }, [step]);

  const flow = step.flow ? (
    <>
      <Header step={step.flow} lang={lang} onHome={noop} onBack={step.flow > 1 ? noop : null} account={account} onProfile={noop} onHelp={noop} />
      <Stepper step={step.flow} lang={lang} />
    </>
  ) : null;

  switch (step.screen) {
    case "home":
      return <Welcome lang={lang} account={account} recentOverride={[]} onStart={noop} onMyProducts={noop} onProfile={noop} onOpenLang={noop} onGuide={noop} />;
    case "photo":
      return (<>{flow}<PhotoStep lang={lang} onDone={noop} onStart3D={noop} /></>);
    case "capture":
      return <CaptureStudio lang={lang} demo={{ image: SAMPLE_IMG, done: step.ticks ? ticks : 2 }} onComplete={noop} onClose={noop} />;
    case "voice":
      return (<>{flow}<VoiceStep lang={lang} imageB64={null} onDone={noop} /></>);
    case "review":
      return (
        <>
          {flow}
          <ReviewStep lang={lang} listing={sample.listing} setListing={noop} setEdited={noop} edited={[]}
            transcript={t("tutSampleSaid", lang)} imageB64={sample.b64} onDone={noop} onHelp={noop} />
        </>
      );
    case "price":
      return (<>{flow}<PriceStep lang={lang} listing={sample.listing} initialData={sample.price} onDone={noop} onHelp={noop} /></>);
    case "final":
      return (
        <>
          {flow}
          <PublishStep lang={lang} listing={sample.listing} price={sample.price.suggested_price} suggestedPrice={sample.price.suggested_price}
            imageB64={sample.b64} account={account} preview onVideo={noop} onHelp={noop} onEditDetails={noop} onEditPrice={noop} />
        </>
      );
    default:
      return null;
  }
}

export default function Tutorial({ lang, setLang, account, onDone }) {
  const [i, setI] = useState(0);
  const [sample, setSample] = useState(null);
  const [rect, setRect] = useState(null); // target box, relative to the tour root
  const [bubble, setBubble] = useState({ top: 0, left: 0, below: true, arrowX: 0 });
  const [showLang, setShowLang] = useState(false);
  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const bubbleRef = useRef(null);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  // A real sample product for the real screens.
  useEffect(() => {
    let alive = true;
    (async () => {
      const listing = demoListing("channapatna wooden toy");
      let b64 = null;
      try {
        const blob = await (await fetch(SAMPLE_IMG)).blob();
        b64 = await fileToB64(blob);
      } catch {}
      if (alive) setSample({ listing, price: demoPrice(listing), b64 });
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Find the real control, scroll it into view inside the stage, measure it.
  const measure = useCallback(() => {
    const root = rootRef.current;
    const el = stageRef.current?.querySelector(`[data-tour="${step.target}"]`);
    if (!root || !el) {
      setRect(null);
      return;
    }
    const rr = root.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) {
      setRect(null);
      return;
    }
    setRect({ x: r.left - rr.left - PAD, y: r.top - rr.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 });
  }, [step.target]);

  useEffect(() => {
    if (!sample) return undefined;
    // Scroll first, then keep measuring briefly: screens settle (fonts,
    // images, async effects) for a moment after mounting.
    const el = stageRef.current?.querySelector(`[data-tour="${step.target}"]`);
    el?.scrollIntoView({ block: "center", behavior: "instant" });
    measure();
    const id = setInterval(measure, 120);
    const stop = setTimeout(() => clearInterval(id), 1500);
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    return () => {
      clearInterval(id);
      clearTimeout(stop);
      window.removeEventListener("resize", onResize);
    };
  }, [i, lang, sample, measure, step.target]);

  // Place the bubble where it fits: below the target, else above, else over
  // the bottom of the screen. Re-run whenever its own size changes — a Tamil
  // sentence is not the length of an English one.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const b = bubbleRef.current;
    if (!root || !b) return;
    const W = root.clientWidth;
    const H = root.clientHeight;
    const bw = b.offsetWidth;
    const bh = b.offsetHeight;
    const margin = 12;
    if (!rect) {
      setBubble({ top: H - bh - 24, left: (W - bw) / 2, below: null, arrowX: bw / 2 });
      return;
    }
    const cx = rect.x + rect.w / 2;
    const left = Math.max(margin, Math.min(W - bw - margin, cx - bw / 2));
    const spaceBelow = H - (rect.y + rect.h) - 16;
    const spaceAbove = rect.y - 64; // leave room for the tour's top bar
    let top;
    let below;
    // Below the target the finger hangs into the gap, so leave it room.
    if (spaceBelow >= bh + 40) {
      top = rect.y + rect.h + 40;
      below = true;
    } else if (spaceAbove >= bh + 18) {
      top = rect.y - bh - 18;
      below = false;
    } else {
      top = H - bh - 16;
      below = null; // overlapping: no arrow
    }
    setBubble({ top, left, below, arrowX: Math.max(22, Math.min(bw - 22, cx - left)) });
  }, [rect, i, lang]);

  function go(n) {
    if (n < 0) return;
    if (n >= STEPS.length) return onDone(true);
    setRect(null);
    setI(n);
  }

  useEffect(() => {
    rootRef.current?.focus();
    const onKey = (e) => {
      if (showLang) return;
      if (e.key === "ArrowRight") go(i + 1);
      else if (e.key === "ArrowLeft") go(i - 1);
      else if (e.key === "Escape") onDone(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const current = LANGS.find((l) => l.code === lang) || LANGS[0];
  const counter = t("obStepOf", lang).replace("{n}", i + 1).replace("{total}", STEPS.length);
  const stageKey = useMemo(() => `${step.screen}`, [step.screen]);

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={t("tutTitle", lang)}
      className="fixed sm:absolute inset-0 z-[60] outline-none overflow-hidden bg-clay-50"
    >
      {/* the real screen, inert */}
      {/* z-0 makes the stage its own stacking context: screens that are
          overlays in the app (the capture studio is z-50) must stay BELOW the
          tour's spotlight and bubble. pt-14 keeps the real header clear of
          the tour's top bar, so nothing it points at is covered by it. */}
      <div ref={stageRef} key={stageKey} className="absolute inset-0 z-0 pt-14 overflow-y-auto pointer-events-none select-none [&_.fixed]:!absolute" inert="" aria-hidden="true">
        {sample ? <Stage step={step} lang={lang} account={account} sample={sample} /> : null}
      </div>

      {/* spotlight: one element whose huge shadow is the dimmed backdrop */}
      {rect ? (
        <div
          className="absolute rounded-2xl tour-spot pointer-events-none"
          style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
          aria-hidden="true"
        >
          <span className="tour-ring" />
          {/* pointer: a finger tapping the control */}
          <svg
            className="tour-finger absolute"
            style={{ left: Math.min(rect.w - 30, rect.w * 0.7), top: rect.h - 18 }}
            width="40"
            height="44"
            viewBox="0 0 40 44"
          >
            <path
              d="M14 4a4 4 0 0 1 8 0v14l7.2 1.8a5 5 0 0 1 3.7 5.6L31 38a4 4 0 0 1-4 3.5H16.5a4 4 0 0 1-3.3-1.7L5.6 29a3.5 3.5 0 0 1 5.3-4.5L14 27.5Z"
              fill="#fff"
              stroke="currentColor" className="text-ink"
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      ) : (
        <div className="absolute inset-0 bg-ink/60 pointer-events-none" aria-hidden="true" />
      )}

      {/* top bar: where you are, language, skip */}
      <div className="absolute left-0 right-0 top-0 flex items-center gap-2 px-3 pt-3 safe-top">
        <span className="rounded-full bg-black/55 text-white text-xs font-bold px-3 py-1.5">{counter}</span>
        <span className="flex-1" />
        <button
          onClick={() => setShowLang(true)}
          className="min-h-[40px] rounded-full bg-white/95 px-3 text-xs font-bold text-clay-800 shadow-soft"
          aria-label={t("chooseLang", lang)}
        >
          <Icon name="globe" size={14} className="inline -mt-0.5" /> {current.native}
        </button>
        <button onClick={() => onDone(false)} className="min-h-[40px] rounded-full bg-white/95 px-4 text-xs font-bold text-clay-800 shadow-soft">
          {t("obSkip", lang)}
        </button>
      </div>

      {/* the explanation */}
      <div
        ref={bubbleRef}
        className="absolute w-[min(340px,calc(100%-24px))] rounded-3xl bg-white shadow-soft p-5 tour-bubble"
        style={{ top: bubble.top, left: bubble.left }}
        aria-live="polite"
      >
        {bubble.below !== null && (
          <span
            className={`absolute h-4 w-4 bg-white rotate-45 ${bubble.below ? "-top-2" : "-bottom-2"}`}
            style={{ left: bubble.arrowX - 8 }}
            aria-hidden="true"
          />
        )}
        <p className="text-[11px] font-bold tracking-wide text-clay-muted">{counter}</p>
        <h2 className="mt-1 text-lg font-extrabold text-clay-900 leading-snug">{t(step.title, lang)}</h2>
        <p className="mt-1.5 text-[15px] text-clay-700 leading-relaxed">{t(step.body, lang)}</p>
        <div className="mt-4 flex items-center gap-2">
          {i > 0 && (
            <button onClick={() => go(i - 1)} className="btn-ghost !w-auto !py-2.5 px-4 !text-sm">
              ← {t("back", lang)}
            </button>
          )}
          <button onClick={() => go(i + 1)} className="btn-primary !py-2.5 !text-base flex-1" autoFocus>
            {last ? t("tutDone", lang) : t("obNext", lang)}
            {!last && <Icon name="chevronRight" size={18} />}
          </button>
        </div>
        <div className="mt-3 flex justify-center gap-1" aria-hidden="true">
          {STEPS.map((_, n) => (
            <span key={n} className={`h-1.5 rounded-full transition-[width,background-color] duration-300 ${n === i ? "w-5 bg-clay-600" : "w-1.5 bg-clay-200"}`} />
          ))}
        </div>
      </div>

      {showLang && <LanguageSheet lang={lang} setLang={setLang} onClose={() => setShowLang(false)} />}
    </div>
  );
}
