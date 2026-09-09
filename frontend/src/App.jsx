import React, { useState } from "react";
import Welcome from "./components/Welcome";
import PhotoStep from "./components/PhotoStep";
import VoiceStep from "./components/VoiceStep";
import ReviewStep from "./components/ReviewStep";
import PriceStep from "./components/PriceStep";
import PublishStep from "./components/PublishStep";
import MyProducts from "./components/MyProducts";
import { Header, Stepper } from "./components/ui";

export default function App() {
  const [lang, setLang] = useState("en");
  const [step, setStep] = useState(0);
  const [imageB64, setImageB64] = useState(null);
  const [, setTranscript] = useState("");
  const [listing, setListing] = useState(null);
  const [price, setPrice] = useState(0);
  const [source, setSource] = useState(null); // 'live' | 'demo'
  const [view, setView] = useState("flow"); // 'flow' | 'products'

  function reset() {
    setStep(1);
    setImageB64(null);
    setTranscript("");
    setListing(null);
    setPrice(0);
  }

  const canBack = step > 1 && step < 5;
  const back = () => setStep((s) => Math.max(1, s - 1));

  return (
    // Phone frame: fills screen on mobile, centered card on desktop
    <div className="min-h-full flex items-stretch sm:items-center justify-center sm:py-6">
      <div className="w-full sm:max-w-[420px] bg-clay-50 sm:rounded-[2.5rem] sm:shadow-soft sm:overflow-hidden min-h-full sm:min-h-[860px] sm:max-h-[92vh] flex flex-col relative">
        {step > 0 && view === "flow" && (
          <>
            <Header step={step} lang={lang} onBack={canBack ? back : null} sourceBadge={source} />
            <Stepper step={step} lang={lang} />
          </>
        )}

        <div className="flex-1 overflow-y-auto">
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
              onStart={() => setStep(1)}
              onMyProducts={() => setView("products")}
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
              onReset={reset}
              onMyProducts={() => setView("products")}
            />
          )}
        </div>
      </div>
    </div>
  );
}
