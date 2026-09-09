import React, { useEffect, useState } from "react";
import { t } from "../lib/i18n";
import { listListings } from "../lib/api";
import { Spinner } from "./ui";
import RemoteImage from "./RemoteImage";

// The artisan's catalogue. This is the screen that answers "is this a product
// or a one-shot demo script?" — publish something, come back here, it's still
// there, because the backend persisted it.

function ProductCard({ row, lang }) {
  const title = row.title?.[lang] || row.title?.en || "";
  const disabled = row._demo;

  const card = (
    <div className="card overflow-hidden active:scale-[0.98] transition">
      <div className="aspect-square bg-clay-100 flex items-center justify-center overflow-hidden">
        {row.has_image && row.image_url ? (
          <RemoteImage
            src={row.image_url}
            alt={title}
            className="w-full h-full object-cover"
            fallback={<span className="text-3xl opacity-40">🧺</span>}
          />
        ) : (
          <span className="text-3xl opacity-40">🧺</span>
        )}
      </div>
      <div className="p-3">
        <p className="text-sm font-semibold text-clay-900 leading-snug line-clamp-2">{title}</p>
        <div className="flex items-center justify-between mt-2">
          <span className="text-sm font-extrabold text-clay-700">
            ₹{Number(row.price).toLocaleString("en-IN")}
          </span>
          <span className="chip !bg-leaf/15 !text-leaf !py-0.5 text-[10px]">● {t("live", lang)}</span>
        </div>
        {row.gi_candidate && (
          <span className="chip mt-2 !py-0.5 text-[10px]">🏷️ {row.gi_candidate}</span>
        )}
      </div>
    </div>
  );

  // In offline demo mode nothing was persisted, so the storefront link would
  // 404. Show the card, just don't promise a page behind it.
  if (disabled) return card;

  return (
    <a href={row.storefront_url} target="_blank" rel="noreferrer" className="block">
      {card}
    </a>
  );
}

export default function MyProducts({ lang, onBack, onSellNew }) {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await listListings();
        if (alive) setRows(Array.isArray(data) ? data : []);
      } catch {
        if (alive) setRows([]); // listListings already falls back; belt-and-braces
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="flex flex-col min-h-full px-5 pt-4 pb-8 safe-top safe-bottom fade-in">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-clay-700 text-sm font-medium">
          ← {t("back", lang)}
        </button>
        <span className="text-xs font-semibold tracking-wide text-clay-500">
          {rows ? rows.length : ""}
        </span>
      </div>

      <div className="mt-4">
        <h2 className="text-2xl font-extrabold text-clay-900">{t("myProducts", lang)}</h2>
        <p className="text-clay-600 mt-1 text-sm">{t("myProductsSub", lang)}</p>
      </div>

      {rows === null ? (
        <div className="flex-1 flex items-center justify-center">
          <Spinner label={t("loadingProducts", lang)} />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <div className="text-5xl opacity-40">🧺</div>
          <p className="font-bold text-clay-900 mt-4">{t("noProducts", lang)}</p>
          <p className="text-clay-600 text-sm mt-2">{t("noProductsSub", lang)}</p>
          <button className="btn-primary mt-6" onClick={onSellNew}>
            {t("start", lang)} →
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mt-5">
            {rows.map((row) => (
              <ProductCard key={row.listing_id} row={row} lang={lang} />
            ))}
          </div>
          <button className="btn-ghost mt-6" onClick={onSellNew}>
            + {t("sellAnother", lang)}
          </button>
        </>
      )}
    </div>
  );
}
