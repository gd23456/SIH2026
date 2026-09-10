import React from "react";
import { t } from "../lib/i18n";

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

export function Header({ step, lang, onBack, sourceBadge, account, onProfile }) {
  return (
    <div className="safe-top px-5 pt-3">
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={onBack}
          className={`text-clay-700 text-sm font-medium ${onBack ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        >
          ← {t("back", lang)}
        </button>
        <span className="text-xs font-semibold tracking-wide text-clay-500">
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

export function Field({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-clay-100 last:border-0">
      <span className="text-clay-500 text-sm">{label}</span>
      <span className="text-clay-900 text-sm font-medium text-right">{value}</span>
    </div>
  );
}
