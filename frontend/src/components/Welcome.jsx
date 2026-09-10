import React, { useEffect, useState } from "react";
import { LANGS, t } from "../lib/i18n";
import { Avatar } from "./ui";
import { listListings, openExternal } from "../lib/api";
import ProductImage from "./ProductImage";

// Home.
//
// This screen used to open with a 3x3 grid of nine language buttons — a
// once-ever setting occupying most of the first thing an artisan ever sees,
// while the actual purpose of the app sat below it. Language is now a chip that
// opens a sheet, and the screen leads with the one action that matters.
//
// It also carried "My products" and "Buyer view" buttons; the bottom nav covers
// both now, so they are gone rather than duplicated.

const HOW_IT_WORKS = [
  { icon: "📷", key: "hiwPhoto" },
  { icon: "🎙️", key: "hiwSpeak" },
  { icon: "🚀", key: "hiwPublish" },
];

export default function Welcome({ lang, account, onStart, onMyProducts, onProfile, onOpenLang }) {
  const [recent, setRecent] = useState(null); // null = loading, [] = none yet

  // A strip of what the artisan has already published, so a returning user sees
  // their own work rather than an empty marketing screen. Never blocks the CTA:
  // any failure just leaves the first-run guidance in place.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const rows = await listListings(6);
        if (alive) setRecent(Array.isArray(rows) ? rows : []);
      } catch {
        if (alive) setRecent([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const current = LANGS.find((l) => l.code === lang) || LANGS[0];
  const hasProducts = Array.isArray(recent) && recent.length > 0;

  return (
    <div className="flex flex-col min-h-full px-5 pt-3 pb-6 safe-top relative">
      {/* top row: identity left, controls right */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <img src="/icon-512.png" alt="" width={38} height={38} className="h-9 w-9 rounded-xl shrink-0" />
          <span className="text-lg font-extrabold text-clay-900 truncate">{t("appName", lang)}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenLang}
            className="rounded-full border border-clay-200 bg-white px-3 py-1.5 text-xs font-bold text-clay-800 active:scale-95 transition"
          >
            {current.native} ▾
          </button>
          {account && <Avatar account={account} size={34} onClick={onProfile} />}
        </div>
      </div>

      {/* the reason the app exists */}
      <div className="mt-6">
        <h1 className="text-[26px] leading-tight font-extrabold text-clay-900">{t("tagline", lang)}</h1>
      </div>

      <button
        onClick={onStart}
        className="mt-5 w-full rounded-3xl bg-clay-600 text-white p-5 shadow-soft active:scale-[0.98] transition text-left"
      >
        <div className="flex items-center gap-4">
          <span className="text-4xl leading-none">📷</span>
          <div className="min-w-0">
            <p className="text-xl font-extrabold">{t("sellCta", lang)}</p>
            <p className="text-sm opacity-85 leading-snug mt-0.5">{t("sellCtaSub", lang)}</p>
          </div>
          <span className="ml-auto text-2xl opacity-80">→</span>
        </div>
      </button>

      {hasProducts ? (
        <div className="mt-7">
          <div className="flex items-baseline justify-between">
            <h2 className="font-bold text-clay-900">{t("yourProducts", lang)}</h2>
            <button onClick={onMyProducts} className="text-xs font-semibold text-clay-600">
              {t("viewAll", lang)} →
            </button>
          </div>
          {/* horizontal strip; -mx/px keeps the cards bleeding to the edge */}
          <div className="mt-3 flex gap-3 overflow-x-auto -mx-5 px-5 pb-1">
            {recent.map((row) => (
              <button
                key={row.listing_id}
                onClick={() => row.storefront_url && openExternal(row.storefront_url)}
                className="w-28 shrink-0 text-left active:scale-[0.98] transition"
              >
                <div className="w-28 h-28 rounded-2xl overflow-hidden bg-clay-100">
                  <ProductImage row={row} className="w-full h-full object-cover" />
                </div>
                <p className="mt-1.5 text-[11px] font-semibold text-clay-800 leading-tight line-clamp-2">
                  {row.title?.[lang] || row.title?.en || ""}
                </p>
                <p className="text-[11px] font-bold text-clay-600">
                  ₹{Number(row.price).toLocaleString("en-IN")}
                </p>
              </button>
            ))}
          </div>
        </div>
      ) : (
        // First run: orient someone who has never seen the app before, instead
        // of showing an empty shelf.
        <div className="mt-7">
          <h2 className="font-bold text-clay-900">{t("howItWorks", lang)}</h2>
          <div className="mt-3 space-y-2.5">
            {HOW_IT_WORKS.map((s, i) => (
              <div key={s.key} className="flex items-center gap-3 rounded-2xl bg-white border border-clay-100 px-4 py-3">
                <span className="text-xl w-7 text-center">{s.icon}</span>
                <span className="text-sm font-semibold text-clay-800">{t(s.key, lang)}</span>
                <span className="ml-auto text-xs font-bold text-clay-300">{i + 1}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-auto pt-6 text-center text-xs text-clay-400">
        Powered by ONDC · Ministry of Textiles ready
      </p>
    </div>
  );
}
