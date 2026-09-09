import React, { useEffect, useState } from "react";
import { t } from "../lib/i18n";
import { getPrice, getLastSource } from "../lib/api";
import { Spinner } from "./ui";

export default function PriceStep({ lang, listing, onDone, setSource }) {
  const [data, setData] = useState(null);
  const [price, setPrice] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const p = await getPrice(listing);
      if (!alive) return;
      setSource?.(getLastSource());
      setData(p);
      setPrice(p.suggested_price);
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!data) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <Spinner label="…" />
      </div>
    );
  }

  const maxBar = Math.max(...data.breakdown.map((b) => b.amount), 1);

  return (
    <div className="flex flex-col min-h-full px-5 pb-8 fade-in">
      <h2 className="text-2xl font-bold text-clay-900 mt-4">{t("fairPrice", lang)}</h2>

      <div className="card p-6 mt-4 text-center">
        <p className="text-clay-500 text-sm">{t("suggested", lang)}</p>
        <div className="text-5xl font-extrabold text-clay-800 mt-1">₹{price.toLocaleString("en-IN")}</div>

        {data.market_median > 0 && (
          <p className="text-sm text-clay-600 mt-2">
            📊 {t("marketMedianLabel", lang)}{" "}
            <span className="font-semibold">₹{data.market_median.toLocaleString("en-IN")}</span>
            {data.market_sample_count > 0 && (
              <> · {data.market_sample_count} {t("comparableListings", lang)}</>
            )}
          </p>
        )}

        <input
          type="range"
          min={data.min_price}
          max={data.max_price}
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
          className="w-full mt-5 accent-clay-600"
        />
        <div className="flex justify-between text-xs text-clay-400 mt-1">
          <span>₹{data.min_price.toLocaleString("en-IN")}</span>
          <span>₹{data.max_price.toLocaleString("en-IN")}</span>
        </div>

        {data.wage_floor_applied && (
          <div className="mt-4 flex items-start gap-2 rounded-2xl bg-leaf/10 px-3 py-2.5 text-left">
            <span className="text-leaf text-base leading-none mt-0.5">🛡️</span>
            <p className="text-[13px] leading-snug text-clay-700 font-medium">{t("wageProtected", lang)}</p>
          </div>
        )}
      </div>

      <div className="card p-5 mt-4">
        <p className="font-semibold text-clay-800 mb-3">{t("whyPrice", lang)}</p>
        <div className="space-y-3">
          {data.breakdown.map((b) => (
            <div key={b.label}>
              <div className="flex justify-between text-sm text-clay-700">
                <span>{b.label}</span>
                <span className="font-medium">₹{b.amount.toLocaleString("en-IN")}</span>
              </div>
              <div className="h-2 rounded-full bg-clay-100 mt-1 overflow-hidden">
                <div className="h-full bg-clay-500 rounded-full" style={{ width: `${(b.amount / maxBar) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
        {data.reasoning?.length > 0 && (
          <ul className="mt-4 space-y-1.5 text-sm text-clay-600 list-disc pl-5">
            {data.reasoning.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        )}
        {data.market_note && <p className="text-xs text-clay-400 mt-3 italic">{data.market_note}</p>}
      </div>

      <button className="btn-primary mt-6" onClick={() => onDone(price)}>
        {t("publish", lang)} 🚀
      </button>
    </div>
  );
}
