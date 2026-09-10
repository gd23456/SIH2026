import React, { useEffect, useRef, useState } from "react";
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
import { Header, Stepper, ConfirmSheet } from "./components/ui";
import { t } from "./lib/i18n";
import { loadStoredAccount } from "./lib/auth";
import { upsertArtisan } from "./lib/api";

export default function App() {
  const [lang, setLang] = useState("en");
  const [step, setStep] = useState(0);
  const [imageB64, setImageB64] = useState(null);
  const [, setTranscript] = useState("");
  const [listing, setListing] = useState(null);
  const [price, setPrice] = useState(0);
  const [source, setSource] = useState(null); // 'live' | 'demo'
  const [view, setView] = useState("flow"); // flow | products | buyer | auth | profile | plans | privacy
  const [showConnect, setShowConnect] = useState(false);
  const [account, setAccount] = useState(() => loadStoredAccount());
  const [confirmExit, setConfirmExit] = useState(false);

  function reset() {
    setStep(1);
    setImageB64(null);
    setTranscript("");
    setListing(null);
    setPrice(0);
  }

  // Start selling: a returning signed-in artisan skips auth; everyone else
  // sees the login screen first.
  function startSelling() {
    if (account) {
      reset();
      setView("flow");
    } else {
      setView("auth");
    }
  }

  function onSignedIn(acc) {
    setAccount(acc);
    // Best-effort sync to the backend; demo-safe (never blocks the flow).
    upsertArtisan({
      uid: acc.uid,
      name: acc.name,
      email: acc.email || "",
      phone: acc.phone || "",
      photo_url: acc.photoURL || "",
    }).catch(() => {});
    reset();
    setView("flow");
  }

  // Step 1 goes back to Welcome rather than nowhere; step 5 is a finished
  // listing, so its "back" is the home button instead.
  const canBack = step >= 1 && step < 5;
  const back = () => (step === 1 ? goHome() : setStep((s) => Math.max(1, s - 1)));

  /** Leave the 5-step flow. Confirms first if there is unsaved work. */
  function goHome() {
    // Nothing entered yet, or already published — no need to ask.
    if (step === 5 || (!imageB64 && !listing)) {
      setStep(0);
      setView("flow");
      return;
    }
    setConfirmExit(true);
  }

  function discardAndGoHome() {
    setConfirmExit(false);
    setStep(0);
    setImageB64(null);
    setTranscript("");
    setListing(null);
    setPrice(0);
    setView("flow");
  }

  // Android hardware back.
  //
  // Capacitor's default when nothing handles `backButton` is to exit the app,
  // so pressing back anywhere — halfway through a listing, inside Profile,
  // with the Connection sheet open — closed Karigar outright and lost the work.
  // This walks one level up the UI instead, and only leaves the app from the
  // welcome screen, which is what Android users expect.
  //
  // The handler is kept in a ref so the listener can be registered once while
  // still seeing current state; re-registering on every state change races with
  // the plugin's async addListener and can drop or double-fire presses.
  const backHandler = useRef(() => {});
  backHandler.current = () => {
    if (showConnect) return setShowConnect(false);
    if (view === "plans" || view === "privacy") return setView("profile");
    if (view !== "flow") return setView("flow"); // products / buyer / profile / auth
    if (step > 1 && step < 5) return back();
    if (step > 0) return setStep(0); // step 1 or the published screen → welcome
    return null; // already at welcome: fall through to exit
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
        // Web build (or plugin unavailable): browsers have their own back.
      }
    })();
    return () => {
      cancelled = true;
      remove?.();
    };
  }, []);

  return (
    // Phone frame: fills screen on mobile, centered card on desktop
    <div className="min-h-full flex items-stretch sm:items-center justify-center sm:py-6">
      <div className="w-full sm:max-w-[420px] bg-clay-50 sm:rounded-[2.5rem] sm:shadow-soft sm:overflow-hidden min-h-full sm:min-h-[860px] sm:max-h-[92vh] flex flex-col relative">
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
            />
            <Stepper step={step} lang={lang} />
          </>
        )}

        <div className="flex-1 overflow-y-auto">
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
              onSignedOut={() => {
                setAccount(null);
                setStep(0);
                setView("flow");
              }}
            />
          )}

          {view === "plans" && (
            <Plans lang={lang} account={account} setAccount={setAccount} onBack={() => setView("profile")} />
          )}

          {view === "privacy" && <Privacy lang={lang} onBack={() => setView("profile")} />}

          {view === "products" && (
            <MyProducts
              lang={lang}
              onBack={() => setView("flow")}
              onSellNew={() => {
                reset();
                setView("flow");
              }}
            />
          )}
          {view === "flow" && step === 0 && (
            <Welcome
              lang={lang}
              setLang={setLang}
              account={account}
              onStart={startSelling}
              onMyProducts={() => setView("products")}
              onBuyerView={() => setView("buyer")}
              onProfile={() => setView("profile")}
              onConnect={() => setShowConnect(true)}
            />
          )}
          {view === "flow" && step === 1 && (
            <PhotoStep
              lang={lang}
              setSource={setSource}
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
                setListing(l);
                setStep(3);
              }}
            />
          )}
          {view === "flow" && step === 3 && listing && (
            <ReviewStep lang={lang} listing={listing} imageB64={imageB64} onDone={() => setStep(4)} />
          )}
          {view === "flow" && step === 4 && listing && (
            <PriceStep
              lang={lang}
              listing={listing}
              setSource={setSource}
              onDone={(p) => {
                setPrice(p);
                setStep(5);
              }}
            />
          )}
          {view === "flow" && step === 5 && listing && (
            <PublishStep
              lang={lang}
              listing={listing}
              price={price}
              imageB64={imageB64}
              account={account}
              onReset={reset}
              onMyProducts={() => setView("products")}
              onBuyerView={() => setView("buyer")}
            />
          )}
        </div>

        {showConnect && <ConnectSheet lang={lang} onClose={() => setShowConnect(false)} />}

        {confirmExit && (
          <ConfirmSheet
            title={t("exitFlow", lang)}
            body={t("exitFlowSub", lang)}
            cancelLabel={t("stay", lang)}
            confirmLabel={t("leave", lang)}
            onCancel={() => setConfirmExit(false)}
            onConfirm={discardAndGoHome}
          />
        )}
      </div>
    </div>
  );
}
