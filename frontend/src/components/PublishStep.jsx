import React, { useEffect, useState } from "react";
import { t } from "../lib/i18n";
import { publish, qrUrl, listChannels, openExternal } from "../lib/api";
import { Spinner, ConfirmSheet } from "./ui";
import RemoteImage from "./RemoteImage";

// Publish once, reach every channel. ONDC is the one real channel (live
// storefront + QR); the rest are honestly-labelled demo publishes. The artisan
// picks channels, then sees a per-channel result list.

export default function PublishStep({ lang, listing, price, imageB64, account, onReset, onMyProducts, onBuyerView, onPlans }) {
  const [phase, setPhase] = useState("select"); // select | publishing | done
  const [channels, setChannels] = useState(null);
  const [selected, setSelected] = useState(() => new Set(["ondc"]));
  const [res, setRes] = useState(null);
  const [showJson, setShowJson] = useState(false);
  const [qrOk, setQrOk] = useState(true);
  const [upsell, setUpsell] = useState(null); // channel id the artisan reached for

  useEffect(() => {
    let alive = true;
    (async () => {
      const chs = await listChannels(account?.uid || "");
      if (!alive) return;
      const list = Array.isArray(chs) ? chs : [];
      setChannels(list);
      // Pre-select ONDC + any already-connected channel the plan actually
      // covers. Pre-ticking a locked one would promise a publish that the
      // backend then refuses.
      setSelected(
        new Set([
          "ondc",
          ...list.filter((c) => c.connected && !c.requires_pro).map((c) => c.id),
        ]),
      );
    })();
    return () => {
      alive = false;
    };
  }, []);

  function toggle(id) {
    if (id === "ondc") return; // ONDC is locked on — the real channel
    // Tapping a Pro channel on the Free plan is the honest moment to ask: the
    // artisan has just told us they want that reach. Show the offer instead of
    // silently ticking a box publish() would drop.
    const ch = channels?.find((c) => c.id === id);
    if (ch?.requires_pro) return setUpsell(id);
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function doPublish() {
    setPhase("publishing");
    const p = await publish({
      listing,
      price,
      image_b64: imageB64,
      channels: Array.from(selected),
      artisan_name: account?.name || "Artisan",
      location: "Bengaluru, Karnataka",
      artisan_uid: account?.uid || null,
      artisan_email: account?.email || "",
      artisan_photo_url: account?.photoURL || "",
    });
    await new Promise((r) => setTimeout(r, 700)); // let the moment land
    setRes(p);
    setPhase("done");
  }

  const title = listing.title?.en || "Handcrafted Product";

  // ---- channel selection ----
  if (phase === "select") {
    return (
      <div className="flex flex-col min-h-full px-5 pb-8 fade-in">
        <h2 className="text-2xl font-bold text-clay-900 mt-4">{t("publishTo", lang)}</h2>
        <p className="text-clay-600 text-sm mt-1">{t("publishOnce", lang)}</p>

        <div className="card p-2 mt-4 divide-y divide-clay-100">
          {channels === null ? (
            <Spinner label="…" />
          ) : (
            channels.map((ch) => {
              const on = selected.has(ch.id);
              const alwaysOn = ch.id === "ondc"; // the real channel, never optional
              const pro = ch.requires_pro;
              return (
                <button
                  key={ch.id}
                  onClick={() => toggle(ch.id)}
                  disabled={alwaysOn}
                  className="w-full flex items-center gap-3 px-2 py-3 text-left"
                >
                  <span className={`text-xl w-7 text-center ${pro ? "opacity-50" : ""}`}>{ch.logo}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${pro ? "text-clay-500" : "text-clay-900"}`}>
                      {ch.name}
                    </p>
                    {pro ? (
                      <span className="text-[10px] font-bold text-clay-500">{t("proOnly", lang)}</span>
                    ) : ch.mode === "live" ? (
                      <span className="text-[10px] font-bold text-leaf">● {t("liveChannel", lang)}</span>
                    ) : (
                      <span className="text-[10px] text-clay-400">{t("demoConnection", lang)}</span>
                    )}
                  </div>
                  {pro ? (
                    <span className="chip !bg-haldi/20 !text-clay-700 !py-0.5 text-[10px] shrink-0">
                      🔒 Pro
                    </span>
                  ) : (
                    <span
                      className={`w-6 h-6 rounded-md flex items-center justify-center text-white text-sm ${
                        on ? "bg-clay-600" : "bg-clay-100"
                      } ${alwaysOn ? "opacity-90" : ""}`}
                    >
                      {on ? "✓" : ""}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        <button className="btn-primary mt-6" onClick={doPublish}>
          {t("publish", lang)} 🚀
        </button>

        {upsell && (
          <ConfirmSheet
            title={t("proUpsellTitle", lang)}
            body={t("proUpsellBody", lang)}
            cancelLabel={t("notNow", lang)}
            confirmLabel={t("seePlans", lang)}
            onCancel={() => setUpsell(null)}
            onConfirm={() => {
              setUpsell(null);
              onPlans?.();
            }}
          />
        )}
      </div>
    );
  }

  if (phase === "publishing" || !res) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <Spinner label={t("publishing", lang)} />
      </div>
    );
  }

  // ---- results ----
  const results = res.channel_results || [];
  const ondc = results.find((r) => r.channel_id === "ondc" && r.kind === "live");

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

      {/* per-channel results */}
      <div className="card p-4 mt-4">
        <p className="font-semibold text-clay-800 mb-2">{t("whereLive", lang)}</p>
        <div className="space-y-2">
          {results.map((r) => {
            const live = r.kind === "live";
            const linkable = live && r.storefront_url;
            return (
              <div key={r.channel_id} className="flex items-center justify-between gap-2 text-sm">
                {linkable ? (
                  <button
                    onClick={() => openExternal(r.storefront_url)}
                    className="text-clay-800 font-medium underline decoration-clay-300 underline-offset-2 truncate text-left"
                  >
                    ✅ {r.status} ↗
                  </button>
                ) : (
                  <span className="text-clay-800 truncate">✅ {r.status}</span>
                )}
                {live ? (
                  <span className="chip !bg-leaf/15 !text-leaf !py-0.5 text-[10px] shrink-0">{t("liveChannel", lang)}</span>
                ) : (
                  <span className="chip !bg-haldi/20 !text-clay-700 !py-0.5 text-[10px] shrink-0">{r.ref}</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Channels the plan didn't cover. Shown after the success, not instead
            of it — the publish did work, this is only what more would buy. */}
        {(res.locked_channels || []).length > 0 && (
          <div className="mt-3 pt-3 border-t border-clay-100">
            <p className="text-xs text-clay-500">
              🔒 {t("proLockedAfterPublish", lang)}{" "}
              <span className="font-semibold text-clay-700">
                {res.locked_channels
                  .map((id) => channels?.find((c) => c.id === id)?.name || id)
                  .join(", ")}
              </span>
            </p>
            <button
              onClick={() => onPlans?.()}
              className="mt-2 text-xs font-bold text-clay-700 underline decoration-clay-300 underline-offset-4"
            >
              {t("seePlans", lang)} →
            </button>
          </div>
        )}
      </div>

      {/* ONDC QR + storefront */}
      {res._demo || !qrOk || !ondc ? (
        <div className="card mt-4 p-5 text-center">
          <p className="text-sm text-clay-500">{t("qrUnavailable", lang)}</p>
        </div>
      ) : (
        <div className="card mt-4 p-5 flex flex-col items-center">
          <p className="font-bold text-clay-900">{t("scanToVisit", lang)}</p>
          <p className="text-xs text-clay-500 mt-1">{t("scanHint", lang)}</p>
          <RemoteImage
            src={qrUrl(res.listing_id)}
            alt={t("scanToVisit", lang)}
            onFail={() => setQrOk(false)}
            className="mt-4 w-full max-w-[240px] aspect-square rounded-2xl border border-clay-100 bg-white"
          />
          {/* The QR is for someone else's phone; this is how the artisan
              opens their own live page without needing a second device. */}
          <button
            onClick={() => openExternal(res.storefront_url)}
            className="btn-primary !mt-4"
          >
            {t("viewProduct", lang)} ↗
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mt-4">
        <button className="btn-ghost !mt-0" onClick={onMyProducts}>
          🗂️ {t("myProducts", lang)}
        </button>
        <button className="btn-ghost !mt-0" onClick={onBuyerView}>
          🛒 {t("buyerView", lang)}
        </button>
      </div>

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
