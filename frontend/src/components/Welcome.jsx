import React from "react";
import { LANGS, t } from "../lib/i18n";
import { Avatar } from "./ui";

export default function Welcome({ lang, setLang, account, onStart, onMyProducts, onBuyerView, onProfile, onConnect }) {
  return (
    <div className="flex flex-col min-h-full px-6 pt-10 pb-10 safe-top safe-bottom relative">
      {account && (
        <div className="absolute top-4 right-5 z-10">
          <Avatar account={account} size={38} onClick={onProfile} />
        </div>
      )}
      <div className="flex-1 flex flex-col items-center justify-center text-center fade-in py-6">
        <div className="h-20 w-20 rounded-3xl bg-clay-600 shadow-soft flex items-center justify-center mb-5">
          <svg viewBox="0 0 512 512" className="h-14 w-14">
            <g fill="none" stroke="#faf6f0" strokeWidth="30" strokeLinecap="round">
              <path d="M176 128 V384" />
              <path d="M176 256 L336 128" />
              <path d="M176 256 L336 384" />
            </g>
            <circle cx="336" cy="128" r="22" fill="#e8a13a" />
          </svg>
        </div>
        <h1 className="text-3xl font-extrabold text-clay-900">{t("appName", lang)}</h1>
        <p className="mt-3 text-clay-700 text-lg leading-snug max-w-xs">{t("tagline", lang)}</p>
      </div>

      <div className="space-y-4">
        <p className="text-center text-clay-600 font-medium">{t("chooseLang", lang)}</p>
        <div className="grid grid-cols-3 gap-2.5">
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => setLang(l.code)}
              className={`rounded-2xl py-2.5 border-2 transition active:scale-95 ${
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
        <button className="btn-primary mt-2" onClick={onStart}>
          {t("start", lang)} →
        </button>
        <div className="grid grid-cols-2 gap-3">
          <button className="btn-ghost !mt-0" onClick={onMyProducts}>
            🗂️ {t("myProducts", lang)}
          </button>
          <button className="btn-ghost !mt-0" onClick={onBuyerView}>
            🛒 {t("buyerView", lang)}
          </button>
        </div>
        <button onClick={onConnect} className="w-full text-center text-xs text-clay-500 py-2 font-medium">
          ⚙︎ {t("connection", lang)}
        </button>
        <p className="text-center text-xs text-clay-400">
          Powered by ONDC · Ministry of Textiles ready
        </p>
      </div>
    </div>
  );
}
