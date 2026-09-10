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

export function Stepper({ step, lang }) {
  const steps = [1, 2, 3, 4, 5];
  return (
    <div className="flex items-center gap-2 px-5 pt-2">
      {steps.map((s) => (
        <div
          key={s}
          className={`h-1.5 flex-1 rounded-full transition-all ${
            s <= step ? "bg-clay-600" : "bg-clay-200"
          }`}
        />
      ))}
    </div>
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

export function Header({ step, lang, onBack, onHome, sourceBadge, account, onProfile }) {
  return (
    <div className="safe-top px-5 pt-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {/* Always reachable. The 5-step flow used to be a trap: step 1 had no
              back, step 5 had none either, so the only way out of a listing you
              did not want to finish was to kill the app. */}
          {onHome && (
            <button
              onClick={onHome}
              className="text-clay-500 text-base leading-none px-1.5 py-1 rounded-lg active:scale-90 transition"
              aria-label={t("home", lang)}
            >
              ⌂
            </button>
          )}
          <button
            onClick={onBack}
            className={`text-clay-700 text-sm font-medium truncate ${
              onBack ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            ← {t("back", lang)}
          </button>
        </div>
        <span className="text-xs font-semibold tracking-wide text-clay-500 shrink-0">
          {t("step", lang)} {step} / 5
        </span>
        <div className="flex items-center gap-2">
          {sourceBadge === "demo" ? (
            <span className="chip !bg-haldi/20 !text-clay-800 !py-0.5 text-[11px]">demo</span>
          ) : sourceBadge === "live" ? (
            <span className="chip !bg-leaf/15 !text-leaf !py-0.5 text-[11px]">● AI</span>
          ) : null}
          {onProfile && <Avatar account={account} size={30} onClick={onProfile} />}
        </div>
      </div>
    </div>
  );
}

/** Small centred confirm sheet — used before discarding an in-progress listing. */
export function ConfirmSheet({ title, body, confirmLabel, cancelLabel, onConfirm, onCancel }) {
  return (
    <div className="absolute inset-0 z-30 flex items-end sm:items-center justify-center bg-black/40 fade-in"
         onClick={onCancel}>
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
    <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/40 fade-in" onClick={onClose}>
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
