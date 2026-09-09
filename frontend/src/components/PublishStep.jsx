import React, { useEffect, useState } from "react";
import { t } from "../lib/i18n";
import { publish, qrUrl } from "../lib/api";
import { Spinner } from "./ui";

export default function PublishStep({ lang, listing, price, imageB64, onReset, onMyProducts }) {
  const [res, setRes] = useState(null);
  const [showJson, setShowJson] = useState(false);
  // If the QR image 404s or the host is unreachable, fall back to text
  // rather than showing a broken-image icon on stage.
  const [qrOk, setQrOk] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      // small delay so the "publishing to ONDC" moment reads well on stage
      const p = await publish({
        listing,
        price,
        image_b64: imageB64,
        artisan_name: "Rukmini Devi",
        location: "Bengaluru, Karnataka",
      });
      await new Promise((r) => setTimeout(r, 900));
      if (alive) setRes(p);
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!res) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <Spinner label={t("publishing", lang)} />
      </div>
    );
  }

  const title = listing.title?.en || "Handcrafted Product";

  return (
    <div className="flex flex-col min-h-full px-5 pb-8 fade-in">
      <div className="text-center mt-8">
        <div className="text-6xl">🎉</div>
        <h2 className="text-2xl font-extrabold text-clay-900 mt-3">{t("published", lang)}</h2>
        <p className="text-clay-600 mt-2 px-4">{t("publishedSub", lang)}</p>
      </div>

      <div className="card overflow-hidden mt-6">
        {imageB64 && (
          <img src={`data:image/png;base64,${imageB64}`} alt="product" className="w-full aspect-[16/10] object-cover" />
        )}
        <div className="p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-clay-900">{title}</h3>
            <span className="text-lg font-extrabold text-clay-700">₹{Number(price).toLocaleString("en-IN")}</span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="chip !bg-leaf/15 !text-leaf">● Live on ONDC</span>
            <span className="chip">{res.listing_id}</span>
          </div>
        </div>
      </div>

      {res._demo || !qrOk ? (
        <div className="card mt-6 p-5 text-center">
          <p className="text-sm text-clay-500">{t("qrUnavailable", lang)}</p>
        </div>
      ) : (
        <div className="card mt-6 p-5 flex flex-col items-center">
          <p className="font-bold text-clay-900">{t("scanToVisit", lang)}</p>
          <p className="text-xs text-clay-500 mt-1">{t("scanHint", lang)}</p>
          <img
            src={qrUrl(res.listing_id)}
            alt={t("scanToVisit", lang)}
            onError={() => setQrOk(false)}
            className="mt-4 w-full max-w-[240px] aspect-square rounded-2xl border border-clay-100 bg-white"
          />
          <a
            href={res.storefront_url}
            target="_blank"
            rel="noreferrer"
            className="mt-4 text-sm font-semibold text-clay-700 underline decoration-clay-300 underline-offset-4"
          >
            {t("openStorefront", lang)} ↗
          </a>
        </div>
      )}

      <button className="btn-ghost mt-4" onClick={onMyProducts}>
        🗂️ {t("myProducts", lang)}
      </button>

      <a href={res.whatsapp_share_url} target="_blank" rel="noreferrer" className="btn-primary mt-3 text-center !bg-[#25D366]">
        {t("shareWhatsapp", lang)} 💬
      </a>

      <button className="btn-ghost mt-3" onClick={() => setShowJson((s) => !s)}>
        {showJson ? "▲ " : "▼ "} {t("ondcPayload", lang)}
      </button>
      {showJson && (
        <pre className="mt-3 bg-clay-900 text-clay-100 text-[10px] leading-relaxed rounded-2xl p-4 overflow-x-auto max-h-64">
          {JSON.stringify(res.ondc_catalog, null, 2)}
        </pre>
      )}

      <button className="text-clay-500 font-medium mt-6 py-3" onClick={onReset}>
        ↺ {t("sellAnother", lang)}
      </button>
    </div>
  );
}
