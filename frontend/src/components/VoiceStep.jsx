import React, { useEffect, useRef, useState } from "react";
import { LANGS, t } from "../lib/i18n";
import { startListening, speechSupported } from "../lib/speech";
import { generateListing, getLastSource } from "../lib/api";
import { Spinner } from "./ui";

export default function VoiceStep({ lang, imageB64, onDone, setSource }) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [busy, setBusy] = useState(false);
  const [supported] = useState(() => !!speechSupported());
  const ctrlRef = useRef(null);
  const speechCode = LANGS.find((l) => l.code === lang)?.speech || "en-IN";

  useEffect(() => () => ctrlRef.current?.stop?.(), []);

  async function toggleMic() {
    if (listening) {
      await ctrlRef.current?.stop?.();
      setListening(false);
      return;
    }
    setTranscript("");
    setListening(true);
    ctrlRef.current = await startListening(speechCode, {
      onPartial: (text) => setTranscript(text),
      onFinal: (text) => {
        if (text) setTranscript(text);
        setListening(false);
      },
      onError: () => setListening(false),
    });
  }

  async function generate() {
    if (!transcript.trim()) return;
    setBusy(true);
    try {
      const listing = await generateListing({ transcript, language: lang, image_b64: imageB64 });
      setSource?.(getLastSource());
      onDone(transcript, listing);
    } finally {
      setBusy(false);
    }
  }

  if (busy) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <Spinner label={t("generating", lang)} />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full px-5 pb-8">
      <h2 className="text-2xl font-bold text-clay-900 mt-4">{t("describe", lang)}</h2>
      <p className="text-clay-500 text-sm mt-1">{t("hintEx", lang)}</p>

      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        {supported && (
          <button onClick={toggleMic} className="relative" aria-label="microphone">
            <span className={listening ? "mic-ring absolute inset-0" : ""} />
            <span
              className={`relative flex items-center justify-center h-36 w-36 rounded-full shadow-soft transition ${
                listening ? "bg-clay-700 scale-105" : "bg-clay-600"
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-16 w-16 text-white" fill="currentColor">
                <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Z" />
                <path d="M19 12a7 7 0 0 1-14 0M12 19v3" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
              </svg>
            </span>
          </button>
        )}
        <p className="text-clay-600 font-medium">
          {listening ? t("listening", lang) : supported ? t("tapMic", lang) : t("orType", lang)}
        </p>

        <div className="w-full">
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder={t("orType", lang) + "…"}
            rows={3}
            className="w-full rounded-2xl border-2 border-clay-200 p-4 text-clay-900 text-lg focus:border-clay-500 outline-none resize-none"
          />
        </div>
      </div>

      <button className="btn-primary" onClick={generate} disabled={!transcript.trim()}>
        {t("generate", lang)} ✨
      </button>
    </div>
  );
}
