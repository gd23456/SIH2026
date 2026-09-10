import React, { useEffect, useState } from "react";
import { t } from "../lib/i18n";
import { searchListings, getLastSource } from "../lib/api";
import { Spinner } from "./ui";
import ProductImage from "./ProductImage";
import { categoryFor } from "../lib/productImage";

// The buyer half of the story: an artisan publishes, then anyone on the ONDC
// network can search and find that exact item. Deliberately dressed as a
// separate "buyer app" (blue ONDC chrome) so the seller flow and the buyer
// flow read as two sides of one network on a single device.

function BuyerCard({ row, lang }) {
  const title = row.title?.[lang] || row.title?.en || "";
  const disabled = row._demo;
  const cat = categoryFor(row);

  const card = (
    <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden active:scale-[0.98] transition shadow-sm">
      <div className="relative aspect-square bg-slate-100 overflow-hidden">
        <ProductImage row={row} className="w-full h-full object-cover" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/50 to-transparent" />
        <span className="absolute left-2 bottom-2 rounded-md bg-black/25 px-1.5 py-0.5 text-[10px] font-bold text-white tracking-wide backdrop-blur-[1px]">
          {cat.label}
        </span>
      </div>
      <div className="p-3">
        <p className="text-sm font-semibold text-slate-800 leading-snug line-clamp-2">{title}</p>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-base font-extrabold text-slate-900">
            ₹{Number(row.price).toLocaleString("en-IN")}
          </span>
        </div>
        {row.gi_verified && (
          <span className="inline-flex items-center gap-1 mt-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
            ✓ {t("verifiedGi", lang)}
            {row.gi_state && <span className="font-normal opacity-80">· {row.gi_state}</span>}
          </span>
        )}
        <p className="mt-2 text-[11px] font-semibold text-sky-600">{t("buyNow", lang)} →</p>
      </div>
    </div>
  );

  if (disabled) return card;
  return (
    <a href={row.storefront_url} target="_blank" rel="noreferrer" className="block">
      {card}
    </a>
  );
}

export default function BuyerView({ lang, onBack }) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState(null);
  const [source, setSource] = useState(null);

  // Debounced live search so results appear as the buyer types.
  useEffect(() => {
    let alive = true;
    const id = setTimeout(async () => {
      setRows(null);
      const data = await searchListings(query);
      if (!alive) return;
      setSource(getLastSource());
      setRows(Array.isArray(data) ? data : []);
    }, 250);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [query]);

  return (
    <div className="flex flex-col min-h-full bg-slate-50 fade-in">
      {/* ONDC-ish buyer-app chrome — blue, distinct from the warm seller UI */}
      <div className="bg-sky-700 text-white px-5 pt-4 pb-4 safe-top">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="text-sky-100 text-sm font-medium">
            ← {t("back", lang)}
          </button>
          <span className="text-xs font-bold tracking-wide bg-white/15 rounded-full px-2.5 py-1">
            {t("ondcNetwork", lang)}
          </span>
          <span className="w-10" />
        </div>
        <div className="mt-3">
          <div className="flex items-center gap-2 bg-white rounded-full px-4 py-2.5">
            <span className="text-slate-400">🔍</span>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder", lang)}
              className="flex-1 bg-transparent text-slate-800 text-sm outline-none placeholder:text-slate-400"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-4 pb-8 safe-bottom">
        <p className="text-xs text-slate-500 mb-3">{t("buyerViewSub", lang)}</p>

        {rows === null ? (
          <div className="flex items-center justify-center py-16">
            <Spinner label="…" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-16 px-4">
            <div className="text-5xl opacity-30">🔍</div>
            <p className="font-bold text-slate-700 mt-4">{t("searchNoResults", lang)}</p>
            <p className="text-slate-500 text-sm mt-2">{t("searchNoResultsSub", lang)}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {rows.map((row) => (
              <BuyerCard key={row.listing_id} row={row} lang={lang} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
