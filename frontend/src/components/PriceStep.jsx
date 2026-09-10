import React, { useEffect, useMemo, useState } from "react";
import { t } from "../lib/i18n";
import { getPrice, getLastSource } from "../lib/api";
import { Spinner } from "./ui";

const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const posPct = (v, lo, hi) => clamp(((v - lo) / (hi - lo)) * 100, 0, 100);

function buildVerdict(d, price) {
  const median = d.market_median || 0;
  const n = d.market_sample_count || 0;
  const hasMarket = median > 0;

  let confLevel = 1, confKey = "confEstimated";
  if (n >= 25) { confLevel = 3; confKey = "confHigh"; }
  else if (n >= 10) { confLevel = 2; confKey = "confGood"; }
  else if (hasMarket) { confLevel = 2; confKey = "confFair"; }

  let tagKey = "verdictFair", tone = "leaf", sentence = t("verdictGeneric", "en");
  if (hasMarket) {
    const diff = (price - median) / median;
    if (diff > 0.15) {
      tagKey = "verdictPremium"; tone = "haldi";
      sentence = `Priced about ${Math.round(diff * 100)}% above the typical ${inr(median)} for ${n} similar pieces — a premium this craft genuinely earns.`;
    } else if (diff < -0.15) {
      tagKey = "verdictValue"; tone = "leaf";
      sentence = `Below the typical ${inr(median)} across ${n} comparable listings — strong value that still pays the maker fairly.`;
    } else {
      tagKey = "verdictCompetitive"; tone = "leaf";
      sentence = `Right in line with the ${inr(median)} that ${n} comparable handmade pieces sell for.`;
    }
  }

  return { tagKey, tone, sentence, confLevel, confKey, hasMarket, median };
}

const TONE = {
  leaf: { text: "text-leaf", bg: "bg-leaf/15", dot: "bg-leaf" },
  haldi: { text: "text-[#9a6b12]", bg: "bg-haldi/20", dot: "bg-haldi" },
  clay: { text: "text-clay-700", bg: "bg-clay-100", dot: "bg-clay-500" },
};

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
    return () => { alive = false; };
  }, []);

  const v = useMemo(() => (data ? buildVerdict(data, price) : null), [data, price]);

  if (!data) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <Spinner label="…" />
      </div>
    );
  }

  // Market-position track domain
  const median = data.market_median || 0;
  const lo = median > 0 ? Math.min(data.min_price, Math.round(median * 0.7)) : data.min_price;
  const hi = median > 0 ? Math.max(data.max_price, Math.round(median * 1.3)) : data.max_price;
  const fairLo = median > 0 ? Math.round(median * 0.85) : data.min_price;
  const fairHi = median > 0 ? Math.round(median * 1.2) : data.max_price;
  const tone = TONE[v.tone];

  return (
    <div className="flex flex-col min-h-full px-5 pb-8 fade-in">
      <h2 className="text-2xl font-bold text-clay-900 mt-4">{t("fairPrice", lang)}</h2>

      {/* Hero price + verdict */}
      <div className="card p-6 mt-4 text-center">
        <p className="text-clay-500 text-sm">{t("suggested", lang)}</p>
        <div className="text-6xl font-extrabold text-clay-800 mt-1 leading-none">{inr(price)}</div>

        <span className={`inline-flex items-center gap-1.5 mt-3 rounded-full ${tone.bg} ${tone.text} px-3 py-1 text-sm font-bold`}>
          ✓ {t(v.tagKey, lang)}
        </span>

        <p className="text-[13.5px] leading-snug text-clay-700 mt-3">{v.sentence}</p>

        {/* Confidence */}
        <div className="flex items-center justify-center gap-1.5 mt-3">
          {[1, 2, 3].map((i) => (
            <span key={i} className={`h-1.5 w-6 rounded-full ${i <= v.confLevel ? tone.dot : "bg-clay-200"}`} />
          ))}
          <span className="text-xs text-clay-500 ml-1">{t(v.confKey, lang)}</span>
        </div>
      </div>

      {/* Market-position bar */}
      {median > 0 && (
        <div className="card p-5 mt-4">
          <div className="flex justify-between text-[11px] font-semibold text-clay-500 mb-2">
            <span>{t("posUnderpriced", lang)}</span>
            <span>{t("posFair", lang)}</span>
            <span>{t("posPremium", lang)}</span>
          </div>
          <div className="relative h-3 rounded-full bg-clay-100 overflow-visible">
            {/* fair zone */}
            <div
              className="absolute top-0 h-3 rounded-full bg-leaf/25"
              style={{ left: `${posPct(fairLo, lo, hi)}%`, width: `${posPct(fairHi, lo, hi) - posPct(fairLo, lo, hi)}%` }}
            />
            {/* median tick */}
            <div className="absolute -top-1 h-5 w-0.5 bg-clay-400" style={{ left: `${posPct(median, lo, hi)}%` }} />
            {/* your price marker */}
            <div
              className="absolute -top-1.5 h-6 w-6 -ml-3 rounded-full bg-clay-700 border-2 border-white shadow-soft"
              style={{ left: `${posPct(price, lo, hi)}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-clay-500 mt-3">
            <span>{inr(lo)}</span>
            <span>{t("marketMedianLabel", lang)} {inr(median)}</span>
            <span>{inr(hi)}</span>
          </div>
        </div>
      )}

      {/* Trust chips */}
      <div className="flex flex-wrap gap-2 mt-4">
        {(() => {
          const chips = [];
          if (data.market_sample_count > 0) chips.push({ text: `${t("benchmarkedOn", lang)} ${data.market_sample_count} ${t("listingsWord", lang)}`, tone: "clay" });
          chips.push({ text: data.wage_floor_applied ? t("wageProtectedChip", lang) : t("aboveWageChip", lang), tone: "leaf" });
          if (data.gi_premium_applied) chips.push({ text: t("giPremiumChip", lang), tone: "haldi" });
          return chips.map((c, i) => (
            <span key={i} className={`inline-flex items-center gap-1 rounded-full ${TONE[c.tone].bg} ${TONE[c.tone].text} px-3 py-1 text-xs font-semibold`}>✓ {c.text}</span>
          ));
        })()}
      </div>

      {/* Adjust within the fair range */}
      <div className="card p-5 mt-4">
        <p className="text-sm font-semibold text-clay-800">{t("adjustPrice", lang)}</p>
        <input
          type="range"
          min={data.min_price}
          max={data.max_price}
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
          className="w-full mt-3 accent-clay-600"
        />
        <div className="flex justify-between text-xs text-clay-400 mt-1">
          <span>{inr(data.min_price)}</span>
          <span>{inr(data.max_price)}</span>
        </div>
      </div>

      <button className="btn-primary mt-6" onClick={() => onDone(price)}>
        {t("publish", lang)} 🚀
      </button>
    </div>
  );
}
