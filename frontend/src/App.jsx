import React, { useEffect, useMemo, useRef, useState } from "react";
import Intro from "./components/Intro";
import Welcome from "./components/Welcome";
import AuthScreen from "./components/AuthScreen";
import PhotoStep from "./components/PhotoStep";
import VoiceStep from "./components/VoiceStep";
import ReviewStep from "./components/ReviewStep";
import PriceStep from "./components/PriceStep";
import PublishStep from "./components/PublishStep";
import MyProducts from "./components/MyProducts";
import BuyerView from "./components/BuyerView";
import Profile from "./components/Profile";
import Plans from "./components/Plans";
import Privacy from "./components/Privacy";
import ConnectSheet from "./components/ConnectSheet";
import VideoStudio from "./components/VideoStudio";
import CaptureStudio from "./components/CaptureStudio";
import Tutorial from "./components/Tutorial";
import { ModelViewer3D } from "./components/Model3D";
import { HelpSheet, GuideSheet, STEP_TOPIC } from "./components/Guide";
import { Header, Stepper, ConfirmSheet, BottomNav, LanguageSheet, Sheet } from "./components/ui";
import { LANGS, t } from "./lib/i18n";
import { loadStoredAccount } from "./lib/auth";
import { upsertArtisan, getLastSource } from "./lib/api";
import { videoDetails, releaseVideo } from "./lib/productVideo";
import { tourSeen, markTourSeen } from "./lib/tour";
import { idbDel, idbGet, idbSet, requestPersistentStorage } from "./lib/idb";
import { ModelSync, initialModelState, newClientId, saveCaptures, loadCaptures, dropCaptures } from "./lib/model3d";
import { flushQueue, getQueue, onQueueChange } from "./lib/publishQueue";
import { addPendingModel, processPendingModels } from "./lib/pendingModels";

const DRAFT_KEY = "draft";

function storedLang() {
  try {
    const l = localStorage.getItem("karigar_lang");
    return LANGS.some((x) => x.code === l) ? l : "en";
  } catch {
    return "en";
  }
}

export default function App() {
  const [lang, setLangState] = useState(storedLang);
  const setLang = (l) => {
    setLangState(l);
    try {
      localStorage.setItem("karigar_lang", l); // a language is chosen once, not per launch
    } catch {}
  };
  const [step, setStep] = useState(0);
  const [imageB64, setImageB64] = useState(null);
  const [transcript, setTranscript] = useState("");
  const [listing, setListing] = useState(null);
  const [edited, setEdited] = useState([]); // listing fields the artisan changed by hand
  const [price, setPrice] = useState(0);
  const [suggestedPrice, setSuggestedPrice] = useState(null);
  const [published, setPublished] = useState(false);
  const [source, setSource] = useState(null); // 'live' | 'demo'
  const [account, setAccount] = useState(() => loadStoredAccount());
  // intro | auth | flow | products | buyer | profile | plans | privacy
  const [view, setView] = useState(() => (loadStoredAccount() ? "flow" : "intro"));
  const [showConnect, setShowConnect] = useState(false);
  const [showLang, setShowLang] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);

  // Guided workflow overlays.
  const [help, setHelp] = useState(null);
  const [showGuide, setShowGuide] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [furthest, setFurthest] = useState(0);
  useEffect(() => setFurthest((f) => Math.max(f, step)), [step]);

  // ---- 3D capture + model ------------------------------------------------
  // `captureId` names this product's photos in IndexedDB from the first shot,
  // so a capture abandoned half-way survives the app closing. It becomes the
  // upload's idempotency key once all six exist.
  const [captureId, setCaptureId] = useState(null);
  const [captures, setCaptures] = useState({}); // angle -> Blob (device copies)
  const [model, setModel] = useState(null); // lib/model3d state
  const [showCapture, setShowCapture] = useState(false);
  const [frontFile, setFrontFile] = useState(null);
  const [showViewer, setShowViewer] = useState(false);
  const syncRef = useRef(null);

  const captureThumbs = useMemo(() => {
    const out = {};
    for (const [a, b] of Object.entries(captures || {})) if (b instanceof Blob) out[a] = URL.createObjectURL(b);
    return out;
  }, [captures]);
  useEffect(() => () => Object.values(captureThumbs).forEach((u) => URL.revokeObjectURL(u)), [captureThumbs]);

  function startSync(state) {
    syncRef.current?.stop();
    const s = new ModelSync({ uid: account?.uid || "", onChange: setModel });
    syncRef.current = s;
    s.start(state);
    return s;
  }
  useEffect(() => () => syncRef.current?.stop(), []);

  function openCapture() {
    if (!captureId) setCaptureId(newClientId());
    setShowCapture(true);
  }

  async function onCapturePartial(blobs) {
    setCaptures(blobs);
    const id = captureId || newClientId();
    if (!captureId) setCaptureId(id);
    await saveCaptures(id, blobs);
  }

  async function onCaptureComplete(blobs) {
    const id = captureId || newClientId();
    setCaptureId(id);
    setCaptures(blobs);
    await saveCaptures(id, blobs);
    setShowCapture(false);
    const m = initialModelState(id);
    setModel(m);
    startSync(m);
    // FRONT becomes the catalogue photo (background-cleaned by the photo step).
    setFrontFile(new File([blobs.front], "front.jpg", { type: "image/jpeg" }));
  }

  const modelHandlers = {
    onView: () => setShowViewer(true),
    onRetry: () => {
      if (!model) return;
      const next = { ...model, skipped: false };
      setModel(next);
      (syncRef.current || startSync(next)).retry();
    },
    onSkip: () => {
      syncRef.current?.stop();
      syncRef.current = null;
      setModel((m) => (m ? { ...m, skipped: true } : m));
    },
  };

  // ---- product video -----------------------------------------------------
  const [video, setVideoState] = useState(null);
  const [videoCtx, setVideoCtx] = useState(null);
  function setVideo(next) {
    setVideoState((prev) => {
      if (prev && prev !== next) releaseVideo(prev);
      return next;
    });
  }
  const videoFor = (img) => (video && img && video.imageKey === img ? video : null);
  function openVideo({ image = imageB64, live = false, link = "" } = {}) {
    if (image) setVideoCtx({ image, live, link });
  }

  // ---- draft: an unfinished product survives the app closing --------------
  const [resumable, setResumable] = useState(null);
  useEffect(() => {
    requestPersistentStorage();
    idbGet(DRAFT_KEY).then((d) => d && d.step >= 1 && setResumable(d));
  }, []);

  useEffect(() => {
    if (published || step < 1 || view !== "flow") return undefined;
    if (!imageB64 && !captureId && !listing) return undefined;
    const id = setTimeout(() => {
      idbSet(DRAFT_KEY, {
        v: 1, step, imageB64, transcript, listing, edited, price, suggestedPrice,
        captureId, model: model ? { ...model } : null, savedAt: Date.now(),
      });
    }, 400);
    return () => clearTimeout(id);
  }, [step, imageB64, transcript, listing, edited, price, suggestedPrice, captureId, model, published, view]);

  async function resumeDraft() {
    const d = resumable;
    if (!d) return;
    setResumable(null);
    setImageB64(d.imageB64 || null);
    setTranscript(d.transcript || "");
    setListing(d.listing || null);
    setEdited(d.edited || []);
    setPrice(d.price || 0);
    setSuggestedPrice(d.suggestedPrice ?? null);
    setCaptureId(d.captureId || null);
    setPublished(false);
    if (d.captureId) {
      const caps = (await loadCaptures(d.captureId)) || {};
      setCaptures(caps);
      // Closed before the photo step finished: redo the FRONT clean-up from
      // the saved capture instead of making the artisan start again.
      if (!d.imageB64 && caps.front) setFrontFile(new File([caps.front], "front.jpg", { type: "image/jpeg" }));
    }
    if (d.model) {
      setModel(d.model);
      if (!d.model.skipped && !["ready"].includes(d.model.phase)) startSync(d.model);
    }
    setFurthest(d.step);
    setStep(d.step);
    setView("flow");
  }

  async function discardDraft(d = resumable) {
    setResumable(null);
    await idbDel(DRAFT_KEY);
    if (d?.captureId) await dropCaptures(d.captureId);
  }

  // ---- offline publish queue ---------------------------------------------
  const [queue, setQueue] = useState([]);
  useEffect(() => {
    getQueue().then(setQueue);
    const off = onQueueChange(setQueue);
    const flush = () => flushQueue().then(() => processPendingModels(account?.uid || ""));
    flush();
    window.addEventListener("online", flush);
    return () => {
      off();
      window.removeEventListener("online", flush);
    };
  }, []);

  // ---- flow control ------------------------------------------------------
  function clearDraft() {
    syncRef.current?.stop();
    syncRef.current = null;
    setImageB64(null);
    setTranscript("");
    setListing(null);
    setEdited([]);
    setPrice(0);
    setSuggestedPrice(null);
    setFurthest(0);
    setVideo(null);
    setModel(null);
    setCaptures({});
    setCaptureId(null);
    setFrontFile(null);
    setPublished(false);
  }

  function reset() {
    clearDraft();
    setStep(1);
  }

  function startSelling() {
    if (!account) return setView("intro");
    if (resumable) return setConfirmReplace(true);
    reset();
    setView("flow");
  }

  function onSignedIn(acc) {
    setAccount(acc);
    upsertArtisan({
      uid: acc.uid, name: acc.name, email: acc.email || "", phone: acc.phone || "", photo_url: acc.photoURL || "",
    }).catch(() => {});
    // A saved product waits on home rather than being overwritten by step 1.
    if (resumable) {
      setStep(0);
    } else reset();
    setView("flow");
  }

  // The document scrolls on phones and the inner div on desktop — reset both,
  // or the next step opens scrolled to wherever the last one was left.
  const scrollRef = useRef(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    window.scrollTo?.(0, 0);
  }, [step, view]);

  const NAV_VIEW = { flow: "sell", products: "products", buyer: "buyer", profile: "profile" };
  const showNav = view !== "auth" && view !== "intro";
  const navTab = NAV_VIEW[view] || (view === "plans" || view === "privacy" ? "profile" : "sell");
  const navigate = (id) => setView(id === "sell" ? "flow" : id);

  // Back works through the final review too; only a PUBLISHED listing has no
  // way back (going back and forward again would publish it twice).
  const canBack = step >= 1 && !(step === 5 && published);
  const back = () => (step === 1 ? goHome() : setStep((s) => Math.max(1, s - 1)));

  function goHome() {
    if (published || (!imageB64 && !listing && !captureId)) {
      if (published) {
        idbDel(DRAFT_KEY);
        clearDraft();
      }
      setStep(0);
      setView("flow");
      return;
    }
    setConfirmExit(true);
  }

  // Leaving mid-product no longer throws it away: it's saved, and waits on home.
  async function saveAndGoHome() {
    setConfirmExit(false);
    const d = await idbGet(DRAFT_KEY);
    syncRef.current?.stop();
    syncRef.current = null;
    setStep(0);
    setView("flow");
    setResumable(d || null);
    clearDraft();
  }

  async function discardAndGoHome() {
    setConfirmExit(false);
    const id = captureId;
    clearDraft();
    await idbDel(DRAFT_KEY);
    if (id) await dropCaptures(id);
    setStep(0);
    setView("flow");
  }

  function onPublished(res, queueId = null) {
    setPublished(true);
    idbDel(DRAFT_KEY);
    syncRef.current?.stop();
    syncRef.current = null;
    if (!model || model.skipped || !captureId) return;
    if (model.jobId && res) {
      // Uploaded before publishing: the publish itself linked the model, and
      // the server holds the photos — the device copies can go.
      dropCaptures(captureId);
      return;
    }
    // Captured offline and not uploaded yet (or still queued): the photos stay
    // on the device and the model follows the product live when it can.
    addPendingModel({ clientId: captureId, model, listingId: res?.listing_id || null, queueId }).then(() =>
      processPendingModels(account?.uid || ""),
    );
  }

  // ---- tutorial + guide --------------------------------------------------
  useEffect(() => {
    const fresh = step === 0 || (step === 1 && !imageB64 && !captureId);
    if (account && view === "flow" && fresh && !tourSeen()) setShowTour(true);
  }, [account, view, step, imageB64, captureId]);

  function finishTour(startNow) {
    markTourSeen();
    setShowTour(false);
    // Opened before login (from the language screen): wherever the tour
    // ends — finished or skipped — the next stop is sign-in.
    if (!account) {
      setView("auth");
      return;
    }
    if (startNow && !resumable) {
      reset();
      setView("flow");
    }
  }

  function openGuide() {
    setHelp(null);
    setShowGuide(true);
  }

  function goFromGuide(row) {
    setShowGuide(false);
    if (row.topic === "video") return openVideo({ image: imageB64 });
    if (row.topic === "qr") return setView("products");
    setView("flow");
    if (row.topic === "capture3d") {
      if (step === 0 && !imageB64) reset();
      setStep(1);
      return openCapture();
    }
    if (row.step === 1 && step === 0 && !imageB64) return reset();
    setStep(row.step);
  }

  // ---- Android hardware back -------------------------------------------------
  const backHandler = useRef(() => {});
  backHandler.current = () => {
    if (showTour) return finishTour(false);
    if (showCapture) return setShowCapture(false);
    if (showViewer) return setShowViewer(false);
    if (videoCtx) return setVideoCtx(null);
    if (help) return setHelp(null);
    if (showGuide) return setShowGuide(false);
    if (showLang) return setShowLang(false);
    if (showConnect) return setShowConnect(false);
    if (confirmExit) return setConfirmExit(false);
    if (confirmReplace) return setConfirmReplace(false);
    if (view === "intro") return null;
    if (view === "auth") return setView("intro");
    if (view === "plans" || view === "privacy") return setView("profile");
    if (view !== "flow") return setView("flow");
    if (canBack && step > 1) return back();
    if (step > 0) return goHome();
    return null;
  };

  useEffect(() => {
    let remove = null;
    let cancelled = false;
    (async () => {
      try {
        const { App: CapApp } = await import("@capacitor/app");
        const handle = await CapApp.addListener("backButton", () => {
          if (backHandler.current() === null) CapApp.exitApp();
        });
        if (cancelled) handle.remove();
        else remove = () => handle.remove();
      } catch {
        // Web build: browsers have their own back.
      }
    })();
    return () => {
      cancelled = true;
      remove?.();
    };
  }, []);


  return (
    <div className="min-h-full flex items-stretch sm:items-center justify-center sm:py-6">
      <div className="w-full sm:max-w-[440px] bg-clay-50 sm:rounded-[2.5rem] sm:shadow-soft sm:overflow-hidden min-h-[100dvh] sm:min-h-0 sm:h-[min(900px,92vh)] flex flex-col relative">
        {step > 0 && view === "flow" && (
          <>
            <Header
              step={step}
              lang={lang}
              onBack={canBack ? back : null}
              onHome={goHome}
              sourceBadge={source}
              account={account}
              onProfile={() => setView("profile")}
              onHelp={() => setHelp(STEP_TOPIC[step])}
            />
            <Stepper step={step} lang={lang} />
          </>
        )}

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {view === "intro" && (
            <Intro
              lang={lang}
              setLang={setLang}
              // First run: the tour comes before the login screen, so a new
              // artisan sees what the app does before being asked to sign in.
              onContinue={() => (tourSeen() ? setView("auth") : setShowTour(true))}
              onTour={() => setShowTour(true)}
              onConnect={() => setShowConnect(true)}
            />
          )}
          {view === "auth" && <AuthScreen lang={lang} onDone={onSignedIn} />}
          {view === "buyer" && <BuyerView lang={lang} onBack={() => setView("flow")} />}
          {view === "profile" && (
            <Profile
              lang={lang}
              account={account}
              setAccount={setAccount}
              onBack={() => setView("flow")}
              onMyProducts={() => setView("products")}
              onPlans={() => setView("plans")}
              onPrivacy={() => setView("privacy")}
              onGuide={openGuide}
              onConnect={() => setShowConnect(true)}
              onSignedOut={() => {
                setAccount(null);
                setStep(0);
                setView("intro");
              }}
            />
          )}
          {view === "plans" && <Plans lang={lang} account={account} setAccount={setAccount} onBack={() => setView("profile")} />}
          {view === "privacy" && <Privacy lang={lang} onBack={() => setView("profile")} />}
          {view === "products" && (
            <MyProducts
              lang={lang}
              account={account}
              onBack={() => setView("flow")}
              onSellNew={startSelling}
              onGuide={openGuide}
            />
          )}

          {view === "flow" && step === 0 && (
            <Welcome
              lang={lang}
              account={account}
              onStart={startSelling}
              onMyProducts={() => setView("products")}
              onProfile={() => setView("profile")}
              onOpenLang={() => setShowLang(true)}
              onGuide={openGuide}
              draft={resumable ? { imageB64: resumable.imageB64, title: resumable.listing?.title?.[lang] || resumable.listing?.title?.en } : null}
              onResume={resumeDraft}
              onDiscardDraft={() => discardDraft()}
              queue={queue}
              onFlushQueue={() => flushQueue()}
            />
          )}
          {view === "flow" && step === 1 && (
            <PhotoStep
              lang={lang}
              setSource={setSource}
              video={video}
              onVideo={(img) => openVideo({ image: img })}
              imageB64={imageB64}
              model={model}
              captureThumbs={captureThumbs}
              frontFile={frontFile}
              onStart3D={openCapture}
              onModel3D={modelHandlers}
              onDone={(img) => {
                setImageB64(img);
                setStep(2);
              }}
            />
          )}
          {view === "flow" && step === 2 && (
            <VoiceStep
              lang={lang}
              imageB64={imageB64}
              setSource={setSource}
              onDone={(tr, l) => {
                setTranscript(tr);
                // Canned text from the offline fallback is flagged, so the
                // review screen tells the artisan to rewrite it.
                setListing({ ...l, _sample: getLastSource() === "demo" });
                setEdited([]);
                setStep(3);
              }}
            />
          )}
          {view === "flow" && step === 3 && listing && (
            <ReviewStep
              lang={lang}
              listing={listing}
              setListing={setListing}
              edited={edited}
              setEdited={setEdited}
              transcript={transcript}
              imageB64={imageB64}
              onDone={() => setStep(4)}
              onHelp={setHelp}
            />
          )}
          {view === "flow" && step === 4 && listing && (
            <PriceStep
              lang={lang}
              listing={listing}
              setSource={setSource}
              onHelp={setHelp}
              initialPrice={furthest >= 5 && price ? price : null}
              onDone={(p, suggested) => {
                setPrice(p);
                setSuggestedPrice(suggested ?? null);
                setStep(5);
              }}
            />
          )}
          {view === "flow" && step === 5 && listing && (
            <PublishStep
              lang={lang}
              listing={listing}
              price={price}
              suggestedPrice={suggestedPrice}
              imageB64={imageB64}
              account={account}
              edited={edited}
              model={model}
              captureThumbs={captureThumbs}
              onModel3D={modelHandlers}
              onEditDetails={() => setStep(3)}
              onEditPrice={() => setStep(4)}
              onPublished={onPublished}
              // Queued counts as done for this draft: the queue holds the
              // payload now, and going back to publish again would duplicate it.
              onQueued={(queueId) => onPublished(null, queueId)}
              onReset={() => {
                idbDel(DRAFT_KEY);
                reset();
              }}
              onMyProducts={() => setView("products")}
              onBuyerView={() => setView("buyer")}
              onPlans={() => setView("plans")}
              onHelp={setHelp}
              video={videoFor(imageB64)}
              onVideo={({ live, link }) => openVideo({ image: imageB64, live, link })}
            />
          )}
        </div>

        {showNav && <BottomNav active={navTab} lang={lang} onNavigate={navigate} />}

        {showCapture && (
          <CaptureStudio
            lang={lang}
            initial={captures}
            onPartial={onCapturePartial}
            onComplete={onCaptureComplete}
            onClose={() => setShowCapture(false)}
          />
        )}

        {showViewer && model?.modelUrl && (
          <Sheet onClose={() => setShowViewer(false)} label={t("m3dView", lang)} closeLabel={t("close", lang)}>
            <div className="px-5 pt-3 pb-6">
              <h2 className="text-xl font-extrabold text-clay-900 pr-10">{t("m3dView", lang)}</h2>
              <div className="mt-4">
                <ModelViewer3D src={model.modelUrl} alt={listing?.title?.en || ""} lang={lang} isTest={model.isTest} />
              </div>
              <button className="btn-ghost mt-4" onClick={() => setShowViewer(false)}>
                {t("vwPhotos", lang)}
              </button>
            </div>
          </Sheet>
        )}

        {videoCtx &&
          (() => {
            const details = videoDetails({ listing, price: step >= 5 ? price : 0, lang, live: videoCtx.live });
            return (
              <VideoStudio
                lang={lang}
                imageB64={videoCtx.image}
                details={details}
                existing={videoFor(videoCtx.image)}
                shareText={[details.title, details.price ? `₹${details.price.toLocaleString("en-IN")}` : "", videoCtx.link]
                  .filter(Boolean)
                  .join(" · ")}
                onResult={(r) => setVideo({ ...r, imageKey: videoCtx.image })}
                onClose={() => setVideoCtx(null)}
                onHelp={() => setHelp("video")}
              />
            );
          })()}

        {help && <HelpSheet topic={help} lang={lang} onClose={() => setHelp(null)} onJourney={videoCtx ? null : openGuide} />}

        {showGuide && (
          <GuideSheet
            lang={lang}
            progress={{
              step: view === "flow" ? step : 0,
              furthest,
              hasImage: Boolean(imageB64),
              locked: step === 5 && published,
              canStart: !imageB64 && !listing && !resumable,
            }}
            onGo={goFromGuide}
            onClose={() => setShowGuide(false)}
            onReplayTour={() => {
              setShowGuide(false);
              setShowTour(true);
            }}
            onStart={() => {
              setShowGuide(false);
              startSelling();
            }}
          />
        )}

        {showTour && <Tutorial lang={lang} setLang={setLang} account={account} onDone={finishTour} />}

        {showConnect && <ConnectSheet lang={lang} onClose={() => setShowConnect(false)} />}
        {showLang && <LanguageSheet lang={lang} setLang={setLang} onClose={() => setShowLang(false)} />}

        {confirmExit && (
          <ConfirmSheet
            title={t("exitSaveTitle", lang)}
            body={t("exitSaveBody", lang)}
            cancelLabel={t("draftDiscard", lang)}
            confirmLabel={t("exitSave", lang)}
            onCancel={discardAndGoHome}
            onConfirm={saveAndGoHome}
            onDismiss={() => setConfirmExit(false)}
          />
        )}
        {confirmReplace && (
          <ConfirmSheet
            title={t("draftReplaceT", lang)}
            body={t("draftReplaceB", lang)}
            cancelLabel={t("cancel", lang)}
            confirmLabel={t("draftReplaceGo", lang)}
            onCancel={() => setConfirmReplace(false)}
            onConfirm={async () => {
              setConfirmReplace(false);
              await discardDraft();
              reset();
              setView("flow");
            }}
          />
        )}
      </div>
    </div>
  );
}
