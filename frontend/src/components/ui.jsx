import React from "react";
import { LANGS, t } from "../lib/i18n";

export function Spinner({ label }) {
  return (
    <div className="flex flex-col items-center gap-4 py-10 fade-in">
      <div className="h-14 w-14 rounded-full border-4 border-clay-200 border-t-clay-600 animate-spin" />
      {label && <p className="text-clay-700 font-medium text-center px-6">{label}</p>}
    </div>
  );
}

// Stepper labels: the bars alone said "you are 2/5 of the way" but not what
// this step IS — so a first-time artisan knew their position, not their task.
const STEP_KEYS = ["stepPhoto", "stepDescribe", "stepListing", "stepPrice", "stepPublish"];

export function Stepper({ step, lang }) {
  const steps = [1, 2, 3, 4, 5];
  return (
    <div className="flex items-center gap-3 px-4 sm:px-5 pt-2 pb-1">
      <div className="flex items-center gap-1.5 flex-1 min-w-0" aria-hidden="true">
        {steps.map((s) => (
          <div
            key={s}
            className={`h-1.5 flex-1 rounded-full transition-all ${s <= step ? "bg-clay-600" : "bg-clay-200"}`}
          />
        ))}
      </div>
      <span className="text-[11px] font-semibold tracking-wide text-clay-500 shrink-0">
        {t("step", lang)} {step}/5 · <span className="text-clay-700">{t(STEP_KEYS[step - 1], lang)}</span>
      </span>
    </div>
  );
}

// ---------------------------------------------------------------- icons ---
// A small stroke icon set (Lucide geometry, 24-grid, 2px) for controls added
// with the guide and video studio. Emoji stay where they illustrate a craft
// step; controls get real icons, which render identically on every phone.
const ICONS = {
  help: ["M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3", "M12 17h.01", { circle: [12, 12, 10] }],
  close: ["M18 6 6 18", "m6 6 12 12"],
  share: [{ circle: [18, 5, 3] }, { circle: [6, 12, 3] }, { circle: [18, 19, 3] }, "m8.59 13.51 6.83 3.98", "m15.41 6.51-6.82 3.98"],
  download: ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "m7 10 5 5 5-5", "M12 15V3"],
  refresh: ["M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8", "M3 3v5h5"],
  check: ["M20 6 9 17l-5-5"],
  video: ["m16 13 5.22 3.48a.5.5 0 0 0 .78-.42V7.9a.5.5 0 0 0-.76-.43L16 10.5", { rect: [2, 6, 14, 12, 2] }],
  sparkles: ["M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z", "M19 3v4", "M21 5h-4"],
  bulb: ["M9 18h6", "M10 22h4", "M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"],
  chevronRight: ["m9 18 6-6-6-6"],
  chevronDown: ["m6 9 6 6 6-6"],
  book: ["M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z", "M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"],
  alert: [{ circle: [12, 12, 10] }, "M12 8v4", "M12 16h.01"],
  lock: [{ rect: [3, 11, 18, 11, 2] }, "M7 11V7a5 5 0 0 1 10 0v4"],
  cube: ["M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z", "m3.3 7 8.7 5 8.7-5", "M12 22V12"],
  camera: ["M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z", { circle: [12, 13, 3] }],
  image: [{ rect: [3, 3, 18, 18, 2] }, { circle: [9, 9, 2] }, "m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"],
  wifiOff: ["M12 20h.01", "M8.5 16.43a5 5 0 0 1 7 0", "M2 8.82a15 15 0 0 1 4.17-2.65", "M10.66 5c4.01-.36 8.14.9 11.34 3.76", "M16.85 11.25a10 10 0 0 1 2.22 1.68", "M5 12.86a10 10 0 0 1 5.17-2.69", "m2 2 20 20"],
  sun: [{ circle: [12, 12, 4] }, "M12 2v2", "M12 20v2", "m4.93 4.93 1.41 1.41", "m17.66 17.66 1.41 1.41", "M2 12h2", "M20 12h2", "m6.34 17.66-1.41 1.41", "m19.07 4.93-1.41 1.41"],
  frame: ["M3 7V5a2 2 0 0 1 2-2h2", "M17 3h2a2 2 0 0 1 2 2v2", "M21 17v2a2 2 0 0 1-2 2h-2", "M7 21H5a2 2 0 0 1-2-2v-2"],
  pencil: ["M21.17 6.81a1 1 0 0 0-3.98-3.98L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z", "m15 5 4 4"],
  mic: ["M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z", "M19 10v2a7 7 0 0 1-14 0v-2", "M12 19v3"],
  tag: ["M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z", { circle: [7.5, 7.5, 0.5] }],
  scale: ["m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z", "m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z", "M7 21h10", "M12 3v18", "M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"],
  send: ["m22 2-7 20-4-9-9-4Z", "M22 2 11 13"],
  globe: [{ circle: [12, 12, 10] }, "M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20", "M2 12h20"],
  bag: ["M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z", "M3 6h18", "M16 10a4 4 0 0 1-8 0"],
  grid: [{ rect: [3, 3, 7, 7, 1] }, { rect: [14, 3, 7, 7, 1] }, { rect: [14, 14, 7, 7, 1] }, { rect: [3, 14, 7, 7, 1] }],
  message: ["M7.9 20A9 9 0 1 0 4 16.1L2 22Z"],
  badgeCheck: ["M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z", "m9 12 2 2 4-4"],
  qr: [{ rect: [3, 3, 5, 5, 1] }, { rect: [16, 3, 5, 5, 1] }, { rect: [3, 16, 5, 5, 1] }, "M21 16h-3a2 2 0 0 0-2 2v3", "M21 21v.01", "M12 7v3a2 2 0 0 1-2 2H7", "M3 12h.01", "M12 3h.01", "M12 16v.01", "M16 12h1", "M21 12v.01", "M12 21v-1"],
};

export function Icon({ name, size = 20, className = "", strokeWidth = 2 }) {
  const parts = ICONS[name] || [];
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      {parts.map((p, i) =>
        typeof p === "string" ? (
          <path key={i} d={p} />
        ) : p.circle ? (
          <circle key={i} cx={p.circle[0]} cy={p.circle[1]} r={p.circle[2]} />
        ) : (
          <rect key={i} x={p.rect[0]} y={p.rect[1]} width={p.rect[2]} height={p.rect[3]} rx={p.rect[4]} />
        ),
      )}
    </svg>
  );
}

/**
 * Bottom sheet: scrim, slide-up panel, close button, Escape to dismiss, focus
 * moved into the dialog on open.
 *
 * `fixed` on phones, `absolute` from sm up. On a phone the frame grows with
 * its content and the DOCUMENT scrolls, so an absolute sheet anchors to the
 * bottom of a frame that may be twice the screen tall — off-screen. From sm
 * the frame has a fixed height and clips, so absolute keeps the sheet inside
 * the phone mock-up. Every overlay added for the guide and the
 * video studio uses it so they all dismiss the same way.
 */
export function Sheet({ onClose, label, closeLabel = "Close", children, tall = false, z = "z-40" }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    ref.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className={`fixed sm:absolute inset-0 ${z} flex items-end justify-center bg-black/45 fade-in-fast`} onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`sheet-up relative w-full bg-clay-50 rounded-t-3xl safe-bottom outline-none flex flex-col ${
          tall ? "h-[92%]" : "max-h-[92%]"
        }`}
      >
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-clay-200 shrink-0" aria-hidden="true" />
        {onClose && (
          <button
            onClick={onClose}
            aria-label={closeLabel}
            className="absolute right-3 top-3 z-10 h-11 w-11 rounded-full flex items-center justify-center text-clay-500 active:scale-90 transition focus-visible:ring-2 focus-visible:ring-clay-500"
          >
            <Icon name="close" size={22} />
          </button>
        )}
        <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>
  );
}

/** Inline "what is this?" link that opens a help topic. */
export function HelpLink({ label, onClick, className = "" }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 min-h-[44px] text-sm font-semibold text-clay-600 underline decoration-clay-300 underline-offset-4 active:opacity-70 ${className}`}
    >
      <Icon name="help" size={16} />
      {label}
    </button>
  );
}

/** Round profile avatar: photo if present, else initials on the clay brand. */
export function Avatar({ account, size = 32, onClick, className = "" }) {
  const name = account?.name || "Artisan";
  const initial = name.trim().charAt(0).toUpperCase() || "A";
  const style = { width: size, height: size };
  const common = `rounded-full overflow-hidden flex items-center justify-center shrink-0 ${className}`;
  const inner = account?.photoURL ? (
    <img src={account.photoURL} alt={name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
  ) : (
    <span className="bg-clay-600 text-white font-bold w-full h-full flex items-center justify-center"
          style={{ fontSize: size * 0.44 }}>
      {initial}
    </span>
  );
  if (!onClick) return <div className={common} style={style}>{inner}</div>;
  return (
    <button onClick={onClick} className={`${common} active:scale-95 transition`} style={style} aria-label="Profile">
      {inner}
    </button>
  );
}

export function Header({ step, lang, onBack, onHome, sourceBadge, account, onProfile, onHelp }) {
  return (
    <div className="safe-top px-4 sm:px-5 pt-3">
      <div className="flex items-center justify-between gap-3">
        {/* left: home + back, comfortable tap targets. Both are conditionally
            rendered now — no invisible placeholder hogging the row. The home
            button stays the always-available exit from the 5-step flow. */}
        <div className="flex items-center gap-1 min-w-0">
          {onHome && (
            <button
              onClick={onHome}
              aria-label={t("home", lang)}
              className="text-clay-500 text-lg leading-none w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition"
            >
              ⌂
            </button>
          )}
          {onBack && (
            <button
              onClick={onBack}
              className="text-clay-700 text-sm font-medium flex items-center gap-1 pl-1 pr-2 h-9 rounded-full active:scale-95 transition truncate"
            >
              ← <span className="truncate">{t("back", lang)}</span>
            </button>
          )}
        </div>
        {/* right: source badge + avatar */}
        <div className="flex items-center gap-2 shrink-0">
          {sourceBadge === "demo" ? (
            <span className="chip !bg-haldi/20 !text-clay-800 !py-0.5 text-[11px]">demo</span>
          ) : sourceBadge === "live" ? (
            <span className="chip !bg-leaf/15 !text-leaf !py-0.5 text-[11px]">● AI</span>
          ) : null}
          {onHelp && (
            <button
              onClick={onHelp}
              aria-label={t("help", lang)}
              className="h-9 w-9 rounded-full flex items-center justify-center text-clay-600 bg-white border border-clay-200 active:scale-90 transition"
            >
              <Icon name="help" size={18} />
            </button>
          )}
          {onProfile && <Avatar account={account} size={32} onClick={onProfile} />}
        </div>
      </div>
    </div>
  );
}

/** Small centred confirm sheet — used before discarding an in-progress listing. */
export function ConfirmSheet({ title, body, confirmLabel, cancelLabel, onConfirm, onCancel, onDismiss }) {
  return (
    // fixed on phones: the document scrolls there, so an absolute sheet would
    // anchor to the bottom of a long page — off-screen (see Sheet).
    <div className="fixed sm:absolute inset-0 z-30 flex items-end sm:items-center justify-center bg-black/40 fade-in"
         onClick={onDismiss || onCancel} role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl p-6 m-0 sm:m-4"
           onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-clay-900">{title}</h3>
        {body && <p className="text-clay-600 text-sm mt-2">{body}</p>}
        <div className="grid grid-cols-2 gap-3 mt-6">
          <button className="btn-ghost !mt-0" onClick={onCancel}>{cancelLabel}</button>
          <button className="btn-primary !mt-0" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

export function Field({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-clay-100 last:border-0">
      <span className="text-clay-500 text-sm">{label}</span>
      <span className="text-clay-900 text-sm font-medium text-right">{value}</span>
    </div>
  );
}

/** Language picker sheet — the nine languages, opened from the home chip. */
export function LanguageSheet({ lang, setLang, onClose }) {
  return (
    <div className="fixed sm:absolute inset-0 z-40 flex items-end justify-center bg-black/40 fade-in" onClick={onClose}
         role="dialog" aria-modal="true" aria-label={t("chooseLang", lang)}>
      <div
        className="w-full bg-clay-50 rounded-t-3xl p-5 pb-8 safe-bottom max-h-full overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-extrabold text-clay-900">{t("chooseLang", lang)}</h3>
          <button onClick={onClose} className="text-clay-500 text-sm font-medium px-2 py-1">
            {t("close", lang)}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => {
                setLang(l.code);
                onClose();
              }}
              className={`rounded-2xl py-3 border-2 transition active:scale-95 ${
                lang === l.code
                  ? "border-clay-600 bg-clay-600 text-white shadow-soft"
                  : "border-clay-200 bg-white text-clay-800"
              }`}
            >
              <div className="text-base font-bold leading-tight">{l.native}</div>
              <div className="text-[10px] opacity-70">{l.label}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const NAV_ITEMS = [
  { id: "sell", labelKey: "navSell", icon: "＋" },
  { id: "products", labelKey: "navProducts", icon: "🗂️" },
  { id: "buyer", labelKey: "navBrowse", icon: "🛒" },
  { id: "profile", labelKey: "navProfile", icon: "☺" },
];

/**
 * Persistent bottom navigation.
 *
 * Without it the app was a forward-only funnel: every destination already
 * existed, none was reachable without first returning to the welcome screen.
 *
 * Selling progress lives in App state, so switching away mid-flow and coming
 * back resumes on the same step with the listing intact — only reset() clears
 * it. That is what makes it safe to show these tabs during the flow.
 */
export function BottomNav({ active, lang, onNavigate }) {
  return (
    <nav className="shrink-0 border-t border-clay-100 bg-clay-50/95 backdrop-blur safe-bottom">
      <div className="flex">
        {NAV_ITEMS.map((item) => {
          const on = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              aria-current={on ? "page" : undefined}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px] py-2 transition active:scale-95 ${
                on ? "text-clay-700" : "text-clay-400"
              }`}
            >
              <span className={`text-lg leading-none ${on ? "scale-110" : ""}`}>{item.icon}</span>
              <span className="text-[10px] font-semibold">{t(item.labelKey, lang)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
