import React from "react";
import { LANGS, t } from "../lib/i18n";

/**
 * The signed-out landing screen: logo, tagline, and the nine languages.
 *
 * Language is chosen HERE, before sign-in, on purpose. Everything downstream —
 * the sign-in screen itself, every error it can show — is already translated,
 * so an artisan who reads only Odia never has to navigate an English screen to
 * reach the language picker. That was the ordering problem with putting the
 * grid behind the login wall.
 *
 * Shown whenever there is no account, which makes sign-out's destination fall
 * out for free rather than needing its own special case.
 */
export default function Intro({ lang, setLang, onContinue, onConnect }) {
  return (
    <div className="flex flex-col min-h-full px-6 pt-10 pb-10 safe-top safe-bottom fade-in">
      <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
        {/* Same asset as the launcher icon, served from /public so it is bundled
            into the APK — no network request, which matters on a demo hotspot
            with no internet. */}
        <img
          src="/icon-512.png"
          alt=""
          width={96}
          height={96}
          className="h-24 w-24 rounded-3xl shadow-soft mb-5"
        />
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
              aria-pressed={lang === l.code}
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

        <button className="btn-primary mt-2" onClick={onContinue}>
          {t("start", lang)} →
        </button>

        {/* Connection has to stay reachable before sign-in. On a fresh install
            localStorage is empty, so the app points at the emulator default and
            every call fails; Profile (the other way in) is behind the login. */}
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
