import React, { useState } from "react";
import { LANGS, t } from "../lib/i18n";
import { Field } from "./ui";

export default function ReviewStep({ lang, listing, imageB64, onDone }) {
  const [view, setView] = useState(lang);
  const title = listing.title?.[view] || listing.title?.en || "";
  const desc = listing.description?.[view] || listing.description?.en || "";

  return (
    <div className="flex flex-col min-h-full px-5 pb-8">
      <h2 className="text-2xl font-bold text-clay-900 mt-4 mb-3">{t("yourListing", lang)}</h2>

      <div className="card overflow-hidden fade-in">
        {imageB64 && (
          <img src={`data:image/png;base64,${imageB64}`} alt="product" className="w-full aspect-square object-cover" />
        )}
        <div className="p-5">
          <div className="flex gap-2 mb-3">
            {LANGS.map((l) => (
              <button
                key={l.code}
                onClick={() => setView(l.code)}
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  view === l.code ? "bg-clay-600 text-white" : "bg-clay-100 text-clay-700"
                }`}
              >
                {l.native}
              </button>
            ))}
          </div>

          <h3 className="text-xl font-bold text-clay-900 leading-snug">{title}</h3>
          {listing.gi_verified ? (
            <span className="inline-flex items-center gap-1.5 mt-2 rounded-full bg-leaf/15 px-3 py-1 text-xs font-bold text-leaf">
              ✓ {t("verifiedGi", lang)}
              {listing.gi_registry_name && <span className="font-semibold">· {listing.gi_registry_name}</span>}
              {listing.gi_state && <span className="font-normal opacity-80">({listing.gi_state})</span>}
            </span>
          ) : (
            listing.gi_candidate && (
              <span className="chip mt-2 !bg-haldi/20 !text-clay-800">🏷️ {t("giTag", lang)}: {listing.gi_candidate}</span>
            )
          )}
          <p className="text-clay-700 mt-3 leading-relaxed text-[15px]">{desc}</p>

          <div className="mt-4">
            <Field label={t("material", lang)} value={listing.material} />
            <Field label={t("category", lang)} value={listing.category} />
            <Field label={t("technique", lang)} value={listing.craft_technique} />
            <Field label={t("time", lang)} value={listing.production_time} />
            <Field label="Size" value={listing.dimensions} />
          </div>

          {listing.tags?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {listing.tags.map((tag) => (
                <span key={tag} className="chip">#{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      <button className="btn-primary mt-6" onClick={onDone}>
        {t("next", lang)} →
      </button>
    </div>
  );
}
