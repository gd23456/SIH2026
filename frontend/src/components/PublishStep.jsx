import React, { useEffect, useMemo, useState } from "react";
import { t } from "../lib/i18n";
import { publish, qrUrl, listChannels, openExternal, getArtisan } from "../lib/api";
import { demoChannels } from "../lib/demoData";
import { queuePublish, flushQueue } from "../lib/publishQueue";
import { renderProductCard } from "../lib/productCard";
import { shareFile, saveFile, fileNameFor } from "../lib/share";
import { ANGLES, viewUrl } from "../lib/model3d";
import { Spinner, ConfirmSheet, HelpLink, Icon } from "./ui";
import RemoteImage from "./RemoteImage";
import { VideoEntry } from "./VideoStudio";
import { Model3DCard, ModelViewer3D } from "./Model3D";
import { Provenance, textProvenance } from "./ReviewStep";
import { ANGLE_KEY } from "./CaptureStudio";

// Step 5: the product page as buyers will see it, one last check, publish.
//
// Publishing is a final, deliberate act: every detail is on one screen with a
// way back to fix it, and the button stays disabled until the artisan ticks
// that they checked. Once live, this screen becomes the sharing hub — QR,
// storefront link, product card and video.

const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");

function Media({ lang, imageB64, model, thumbs, title }) {
  const [mode, setMode] = useState("photos");
  const [sel, setSel] = useState("main");
  const canShow3d = model?.phase === "ready" && model.modelUrl;
  const views = ANGLES.filter((a) => thumbs[a]);
  const src = sel === "main" ? `data:image/png;base64,${imageB64}` : thumbs[sel];

  return (
    <div data-tour="final-media">
      {canShow3d && (
        <div className="flex gap-2 mb-3" role="group" aria-label={t("m3dView", lang)}>
          {["photos", "3d"].map((m) => (
            <button
              key={m}
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={`flex-1 min-h-[44px] rounded-xl border-2 text-sm font-bold transition inline-flex items-center justify-center gap-1.5 whitespace-nowrap ${
                mode === m ? "bg-clay-600 border-clay-600 text-white" : "bg-white border-clay-200 text-clay-800"
              }`}
            >
              {m === "3d" && <Icon name="cube" size={18} />}
              {m === "3d" ? t("m3dView", lang) : t("vwPhotos", lang)}
            </button>
          ))}
        </div>
      )}
      {mode === "3d" && canShow3d ? (
        <ModelViewer3D src={model.modelUrl} alt={title} lang={lang} isTest={model.isTest} />
      ) : (
        <>
          {imageB64 && <img src={src} alt={title} className="w-full aspect-square object-cover rounded-2xl bg-clay-100" />}
          {views.length > 0 && (
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {["main", ...views].map((a) => (
                <button
                  key={a}
                  onClick={() => setSel(a)}
                  aria-pressed={sel === a}
                  className={`shrink-0 rounded-xl border-2 ${sel === a ? "border-clay-600" : "border-transparent"}`}
                >
                  <img
                    src={a === "main" ? `data:image/png;base64,${imageB64}` : thumbs[a]}
                    alt={a === "main" ? title : t(ANGLE_KEY[a], lang)}
                    className="h-14 w-14 rounded-[10px] object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function PublishStep({
  lang, listing, price, suggestedPrice, imageB64, account, edited = [], model, captureThumbs = {},
  onEditDetails, onEditPrice, onReset, onMyProducts, onBuyerView, onPlans, onHelp, onVideo, video,
  onPublished, onQueued, onModel3D, preview = false,
}) {
  const [phase, setPhase] = useState("review"); // review | publishing | queued | done
  const [channels, setChannels] = useState(preview ? demoChannels() : null);
  const [selected, setSelected] = useState(() => new Set(["ondc"]));
  const [confirmed, setConfirmed] = useState(false);
  const [res, setRes] = useState(null);
  const [error, setError] = useState("");
  const [showJson, setShowJson] = useState(false);
  const [qrOk, setQrOk] = useState(true);
  const [upsell, setUpsell] = useState(null);
  const [location, setLocation] = useState("");
  const [cardBusy, setCardBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (preview) return undefined;
    let alive = true;
    (async () => {
      const chs = await listChannels(account?.uid || "");
      if (!alive) return;
      const list = Array.isArray(chs) ? chs : [];
      setChannels(list);
      // Pre-select ONDC + any connected channel the plan actually covers.
      setSelected(new Set(["ondc", ...list.filter((c) => c.connected && !c.requires_pro).map((c) => c.id)]));
      // The maker's real location for the listing — it used to be hardcoded.
      if (account?.uid) {
        const a = await getArtisan(account.uid);
        if (alive && a?.location) setLocation(a.location);
      }
    })();
    return () => {
      alive = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Captured views: device copies while they exist, server copies after.
  const thumbs = useMemo(() => {
    const out = { ...captureThumbs };
    if (model?.jobId && model.token) {
      for (const a of ANGLES) if (!out[a]) out[a] = viewUrl(model.jobId, a, model.token);
    }
    return out;
  }, [captureThumbs, model?.jobId, model?.token]);

  function toggle(id) {
    if (id === "ondc") return; // the real channel, always on
    const ch = channels?.find((c) => c.id === id);
    if (ch?.requires_pro) return setUpsell(id);
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const payload = () => ({
    listing,
    price,
    image_b64: imageB64,
    channels: Array.from(selected),
    artisan_name: account?.name || "Artisan",
    location: location || "India",
    artisan_uid: account?.uid || null,
    artisan_email: account?.email || "",
    artisan_photo_url: account?.photoURL || "",
    model_job_id: model && !model.skipped ? model.jobId : null,
    model_token: model && !model.skipped ? model.token : null,
    edited_fields: edited,
  });

  async function doPublish() {
    if (preview || !confirmed || unreviewedSample) return;
    setPhase("publishing");
    setError("");
    const body = payload();
    try {
      const p = await publish(body);
      await new Promise((r) => setTimeout(r, 500)); // let the moment land
      setRes(p);
      setPhase("done");
      onPublished?.(p);
    } catch (e) {
      if (e.network) {
        // Offline or server down: keep it, send it the moment we can.
        const queueId = await queuePublish(body, { title: listing.title?.en || "" });
        setPhase("queued");
        onQueued?.(queueId);
      } else {
        setError(t("pubFailed", lang));
        setPhase("review");
      }
    }
  }

  async function tryQueuedNow() {
    setPhase("publishing");
    const sent = await flushQueue();
    const mine = sent.find((s) => s.entry.payload.image_b64 === imageB64);
    // The draft was already handed to the queue (onQueued), so this only
    // shows the result — calling onPublished again would double-book it.
    if (mine) {
      setRes(mine.result);
      setPhase("done");
    } else setPhase("queued");
  }

  async function shareCard() {
    if (!res) return;
    setCardBusy(true);
    setNotice("");
    try {
      const blob = await renderProductCard({
        imageB64,
        title: listing.title?.en || "",
        nativeTitle: lang !== "en" ? listing.title?.[lang] || "" : "",
        price,
        giName: listing.gi_registry_name || "",
        giVerified: Boolean(listing.gi_verified),
        listingId: res._demo ? null : res.listing_id,
        link: res.storefront_url,
      });
      const filename = fileNameFor(listing.title?.en, "jpg");
      const r = await shareFile({ blob, filename, title: listing.title?.en || "", text: res.storefront_url || "" });
      if (r === "unsupported") {
        const s = await saveFile({ blob, filename });
        setNotice(s === "failed" ? t("vidActionFailed", lang) : t("vidShareFallback", lang));
      } else if (r === "failed") setNotice(t("vidActionFailed", lang));
    } catch {
      setNotice(t("vidActionFailed", lang));
    } finally {
      setCardBusy(false);
    }
  }

  const title = listing.title?.[lang] || listing.title?.en || "";
  const story = listing.description?.[lang] || listing.description?.en || "";
  const sample = Boolean(listing._sample);
  // Placeholder copy from the offline fallback must never go live as-is.
  const unreviewedSample = sample && !edited.includes("title") && !edited.includes("description");

  // ---------------------------------------------------------------- review ---
  if (phase === "review") {
    return (
      <div className="flex flex-col min-h-full px-4 sm:px-5 pb-8 fade-in">
        <h2 className="text-2xl font-bold text-clay-900 mt-3">{t("finalTitle", lang)}</h2>
        <p className="text-clay-600 text-sm mt-1">{t("finalSub", lang)}</p>

        <div className="card p-3 mt-4">
          <Media lang={lang} imageB64={imageB64} model={model} thumbs={thumbs} title={title} />
          {model && model.phase !== "ready" && (
            <div className="mt-3">
              <Model3DCard lang={lang} model={model} compact bare {...onModel3D} />
            </div>
          )}
        </div>

        <div className="card p-5 mt-3">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-xl font-extrabold text-clay-900 leading-snug">{title}</h3>
            <span className="text-2xl font-extrabold text-clay-800 shrink-0 tabular-nums">{inr(price)}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Provenance kind={textProvenance("title", edited, sample)} lang={lang} />
            {suggestedPrice != null && price !== suggestedPrice ? (
              <span className="inline-flex items-center rounded-full bg-indigo-brand/10 text-indigo-brand px-2 py-0.5 text-[10px] font-bold">
                {t("priceYours", lang)}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-leaf/15 text-leaf px-2 py-0.5 text-[10px] font-bold">
                {t("wageProtectedChip", lang)}
              </span>
            )}
          </div>

          {listing.gi_verified ? (
            <p className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-leaf/15 px-3 py-1 text-xs font-bold text-leaf">
                ✓ {t("verifiedGi", lang)} · {listing.gi_registry_name}
              </span>
              <Provenance kind="verified" lang={lang} />
            </p>
          ) : listing.gi_candidate ? (
            <p className="mt-3 flex flex-wrap items-center gap-2">
              <span className="chip !text-xs !bg-haldi/20"><Icon name="tag" size={13} /> {listing.gi_candidate}</span>
              <Provenance kind="pending" lang={lang} />
            </p>
          ) : null}

          <p className="text-xs font-bold text-clay-muted mt-4">{t("finalStory", lang)}</p>
          <p className="text-clay-700 mt-1 text-[15px] leading-relaxed">{story}</p>

          <dl className="mt-3 text-sm">
            {[["material", listing.material], ["technique", listing.craft_technique], ["fldSize", listing.dimensions], ["time", listing.production_time]]
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-1.5 border-b border-clay-100 last:border-0">
                  <dt className="text-clay-muted">{t(k, lang)}</dt>
                  <dd className="text-clay-900 font-medium text-right">{v}</dd>
                </div>
              ))}
          </dl>

          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-clay-50 px-3 py-2.5">
            <span className="h-9 w-9 rounded-full bg-clay-600 text-white font-bold flex items-center justify-center shrink-0">
              {(account?.name || "A").charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-clay-muted">{t("finalArtisan", lang)}</p>
              <p className="text-sm font-semibold text-clay-900 truncate">
                {account?.name || "Artisan"} · {location || "India"}
              </p>
            </div>
          </div>

          {/* stacked: side by side, the Tamil/Telugu labels wrap to two lines */}
          <div className="flex flex-col gap-2 mt-4">
            <button className="btn-ghost !py-2.5 !text-sm whitespace-nowrap" onClick={onEditDetails}>
              <Icon name="pencil" size={16} /> {t("finalEditDetails", lang)}
            </button>
            <button className="btn-ghost !py-2.5 !text-sm whitespace-nowrap" onClick={onEditPrice}>
              <Icon name="scale" size={16} /> {t("finalEditPrice", lang)}
            </button>
          </div>
        </div>

        {onVideo && (
          <div className="mt-3" data-tour="video-entry">
            <VideoEntry lang={lang} video={video} needsDetails={Boolean(video && !video.hasDetails)} onOpen={() => onVideo({ live: false, link: "" })} />
          </div>
        )}

        <h3 className="font-bold text-clay-900 mt-6">{t("publishTo", lang)}</h3>
        <p className="text-clay-600 text-sm">{t("publishOnce", lang)}</p>
        {onHelp && <HelpLink label={t("whatPublishMeans", lang)} onClick={() => onHelp("publish")} className="self-start -mb-1" />}
        <div className="card p-2 mt-2 divide-y divide-clay-100">
          {channels === null ? (
            <Spinner label="…" />
          ) : (
            channels.map((ch) => {
              const on = selected.has(ch.id);
              const alwaysOn = ch.id === "ondc";
              const pro = ch.requires_pro;
              return (
                <button
                  key={ch.id}
                  onClick={() => toggle(ch.id)}
                  disabled={alwaysOn || preview}
                  aria-pressed={on}
                  className="w-full flex items-center gap-3 px-2 py-3 text-left min-h-[52px]"
                >
                  <span className={`text-xl w-7 text-center ${pro ? "opacity-50" : ""}`}>{ch.logo}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${pro ? "text-clay-muted" : "text-clay-900"}`}>{ch.name}</p>
                    {pro ? (
                      <span className="text-[10px] font-bold text-clay-muted">{t("proOnly", lang)}</span>
                    ) : ch.mode === "live" ? (
                      <span className="text-[10px] font-bold text-leaf">● {t("liveChannel", lang)}</span>
                    ) : (
                      <span className="text-[10px] text-clay-muted">{t("demoConnection", lang)}</span>
                    )}
                  </div>
                  {pro ? (
                    <span className="chip !bg-haldi/20 !text-clay-700 !py-0.5 text-[10px] shrink-0"><Icon name="lock" size={11} /> Pro</span>
                  ) : (
                    <span className={`w-6 h-6 rounded-md flex items-center justify-center text-white text-sm ${on ? "bg-clay-600" : "bg-clay-100"}`}>
                      {on ? "✓" : ""}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        <label className="mt-5 flex items-start gap-3 rounded-2xl border-2 border-clay-200 bg-white px-4 py-3.5 cursor-pointer">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 h-5 w-5 accent-clay-600 shrink-0"
          />
          <span className="text-sm font-semibold text-clay-900 leading-snug">{t("finalConfirm", lang)}</span>
        </label>

        {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}

        {unreviewedSample && !preview && (
          <div className="mt-4 rounded-2xl bg-red-50 border border-red-200 px-4 py-3" role="alert">
            <p className="text-sm text-red-800 leading-snug">{t("pubSampleBlock", lang)}</p>
            <button onClick={onEditDetails} className="mt-2 min-h-[40px] text-sm font-bold text-red-800 underline underline-offset-4">
              <Icon name="pencil" size={14} className="inline -mt-0.5" /> {t("finalEditDetails", lang)}
            </button>
          </div>
        )}

        <button className="btn-primary mt-4" onClick={doPublish} disabled={(!confirmed || unreviewedSample) && !preview} data-tour="publish-btn">
          {selected.size > 1 ? t("publishToN", lang).replace("{n}", selected.size) : t("publishNow", lang)} <Icon name="send" size={18} />
        </button>
        {!confirmed && !preview && <p className="text-center text-xs text-clay-muted mt-2">{t("finalConfirmNeeded", lang)}</p>}

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

  if (phase === "publishing") {
    return (
      <div className="min-h-full flex items-center justify-center">
        <Spinner label={t("publishingNeutral", lang)} />
      </div>
    );
  }

  if (phase === "queued") {
    return (
      <div className="flex flex-col min-h-full px-5 pb-8 fade-in items-center justify-center text-center">
        <span className="h-16 w-16 rounded-full bg-haldi/20 text-clay-800 flex items-center justify-center" aria-hidden="true"><Icon name="wifiOff" size={30} /></span>
        <h2 className="text-xl font-extrabold text-clay-900 mt-4">{t("pubQueuedTitle", lang)}</h2>
        <p className="text-clay-600 mt-2 leading-relaxed">{t("pubQueued", lang)}</p>
        <button className="btn-primary mt-6" onClick={tryQueuedNow}>
          <Icon name="refresh" size={18} /> {t("pubRetryNow", lang)}
        </button>
        <button className="btn-ghost mt-3" onClick={onReset}>↺ {t("sellAnother", lang)}</button>
      </div>
    );
  }

  // ---------------------------------------------------------------- done ---
  const results = res.channel_results || [];
  const ondc = results.find((r) => r.channel_id === "ondc" && r.kind === "live");

  return (
    <div className="flex flex-col min-h-full px-4 sm:px-5 pb-8 fade-in">
      <div className="text-center mt-8">
        <span className="mx-auto h-16 w-16 rounded-full bg-leaf/15 text-leaf flex items-center justify-center" aria-hidden="true">
          <Icon name="badgeCheck" size={36} />
        </span>
        <h2 className="text-2xl font-extrabold text-clay-900 mt-3">{t("published", lang)}</h2>
        <p className="text-clay-600 mt-2 px-4">{t("publishedSub", lang)}</p>
      </div>

      <div className="card overflow-hidden mt-6">
        {imageB64 && <img src={`data:image/png;base64,${imageB64}`} alt={title} className="w-full aspect-[16/10] object-cover" />}
        <div className="p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-bold text-clay-900">{listing.title?.en || title}</h3>
            <span className="text-lg font-extrabold text-clay-700">{inr(price)}</span>
          </div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="chip !bg-leaf/15 !text-leaf">● {t("liveChannel", lang)} · ONDC</span>
            <span className="chip !text-xs">{res.listing_id}</span>
          </div>
        </div>
      </div>

      <div className="card p-4 mt-4">
        <p className="font-semibold text-clay-800 mb-2">{t("whereLive", lang)}</p>
        <div className="space-y-2">
          {results.map((r) => {
            const live = r.kind === "live";
            return (
              <div key={r.channel_id} className="flex items-center justify-between gap-2 text-sm">
                {live && r.storefront_url ? (
                  <button
                    onClick={() => openExternal(r.storefront_url)}
                    className="text-clay-800 font-medium underline decoration-clay-300 underline-offset-2 truncate text-left min-h-[36px]"
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
        {(res.locked_channels || []).length > 0 && (
          <div className="mt-3 pt-3 border-t border-clay-100">
            <p className="text-xs text-clay-muted">
              <Icon name="lock" size={12} className="inline -mt-0.5" /> {t("proLockedAfterPublish", lang)}{" "}
              <span className="font-semibold text-clay-700">
                {res.locked_channels.map((id) => channels?.find((c) => c.id === id)?.name || id).join(", ")}
              </span>
            </p>
            <button onClick={() => onPlans?.()} className="mt-2 text-xs font-bold text-clay-700 underline decoration-clay-300 underline-offset-4 min-h-[36px]">
              {t("seePlans", lang)} →
            </button>
          </div>
        )}
      </div>

      {res._demo || !qrOk || !ondc ? (
        <div className="card mt-4 p-5 text-center">
          <p className="text-sm text-clay-muted">{t("qrUnavailable", lang)}</p>
        </div>
      ) : (
        <div className="card mt-4 p-5 flex flex-col items-center">
          <p className="font-bold text-clay-900">{t("scanToVisit", lang)}</p>
          <p className="text-xs text-clay-muted mt-1">{t("scanHint", lang)}</p>
          <RemoteImage
            src={qrUrl(res.listing_id)}
            alt={t("scanToVisit", lang)}
            onFail={() => setQrOk(false)}
            className="mt-4 w-full max-w-[240px] aspect-square rounded-2xl border border-clay-100 bg-white"
          />
          <button onClick={() => openExternal(res.storefront_url)} className="btn-primary !mt-4">
            {t("viewProduct", lang)} ↗
          </button>
          {onHelp && <HelpLink label={t("howQrWorks", lang)} onClick={() => onHelp("qr")} className="mt-1 !text-xs" />}
        </div>
      )}

      {/* the picture that IS the listing in a WhatsApp group */}
      <button onClick={shareCard} disabled={cardBusy} className="card p-3 mt-4 w-full flex items-center gap-3 text-left active:scale-[0.98] transition disabled:opacity-60" data-tour="share-card">
        <span className="h-12 w-12 rounded-2xl bg-clay-100 text-clay-700 flex items-center justify-center shrink-0">
          <Icon name="share" size={22} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-bold text-clay-900 text-[15px]">{t("shareCard", lang)}</span>
          <span className="block text-xs text-clay-muted mt-0.5">{t("shareCardSub", lang)}</span>
        </span>
        {cardBusy ? <span className="h-5 w-5 rounded-full border-2 border-clay-200 border-t-clay-600 animate-spin" /> : <Icon name="chevronRight" size={20} className="text-clay-muted" />}
      </button>
      {notice && <p className="text-center text-sm text-clay-700 mt-2" role="status">{notice}</p>}

      {onVideo && (
        <div className="mt-3">
          <VideoEntry
            lang={lang}
            video={video}
            needsDetails={Boolean(video && !video.hasDetails)}
            onOpen={() => onVideo({ live: !res._demo, link: res.storefront_url || "" })}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mt-4">
        <button className="btn-ghost !mt-0" onClick={onMyProducts}><Icon name="grid" size={18} /> {t("myProducts", lang)}</button>
        <button className="btn-ghost !mt-0" onClick={onBuyerView}><Icon name="bag" size={18} /> {t("buyerView", lang)}</button>
      </div>

      <a href={res.whatsapp_share_url} target="_blank" rel="noreferrer" className="btn-primary mt-3 text-center !bg-whatsapp">
        <Icon name="message" size={18} /> {t("shareWhatsapp", lang)}
      </a>

      <button className="btn-ghost mt-3" onClick={() => setShowJson((s) => !s)}>
        {showJson ? "▲ " : "▼ "} {t("ondcPayload", lang)}
      </button>
      {showJson && (
        <pre className="mt-3 bg-clay-900 text-clay-100 text-[10px] leading-relaxed rounded-2xl p-4 overflow-x-auto max-h-64">
          {JSON.stringify(res.ondc_catalog, null, 2)}
        </pre>
      )}

      <button className="text-clay-muted font-medium mt-6 py-3" onClick={onReset}>↺ {t("sellAnother", lang)}</button>
    </div>
  );
}

