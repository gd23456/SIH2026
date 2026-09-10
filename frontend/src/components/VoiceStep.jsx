import React, { useEffect, useRef, useState } from "react";
import { LANGS, t } from "../lib/i18n";
import { startListening, speechSupported, supportedLanguages } from "../lib/speech";
import { generateListing, getLastSource } from "../lib/api";
import { Spinner } from "./ui";

export default function VoiceStep({ lang, imageB64, onDone, setSource }) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [busy, setBusy] = useState(false);
  const [supported] = useState(() => !!speechSupported());
  const [micError, setMicError] = useState(null); // i18n key or null
  const [langMissing, setLangMissing] = useState(false);
  const ctrlRef = useRef(null);
  const speechCode = LANGS.find((l) => l.code === lang)?.speech || "en-IN";

  useEffect(() => () => ctrlRef.current?.stop?.(), []);

  // Warn ahead of time when this phone has no voice pack for the chosen
  // language. Android 13+ refuses to answer the query at all, so an empty
  // list means "unknown" and must NOT be treated as unsupported.
  useEffect(() => {
    let alive = true;
    setLangMissing(false);
    setMicError(null);
    supportedLanguages().then((list) => {
      if (!alive || list.length === 0) return;
      const base = speechCode.split("-")[0].toLowerCase();
      const ok = list.some((l) => l.toLowerCase().startsWith(base));
      setLangMissing(!ok);
    });
    return () => {
      alive = false;
    };
  }, [speechCode]);

  /** Map a recogniser error onto something the artisan can act on. */
  function explain(err) {
    const e = String(err || "").toLowerCase();
    if (e.includes("permission")) return "micDenied";
    // Android surfaces a missing voice pack as ERROR_LANGUAGE_NOT_SUPPORTED /
    // ERROR_LANGUAGE_UNAVAILABLE, and some ROMs just say "not available".
    if (e.includes("language") || e.includes("unavailable") || e.includes("not supported")) {
      return "micLangMissing";
    }
    return "micGeneric";
  }

  async function toggleMic() {
    if (listening) {
      await ctrlRef.current?.stop?.();
      setListening(false);
      return;
    }
    setMicError(null);
    // Keep whatever is already in the box and append to it, rather than
    // wiping a transcript the artisan has already typed or dictated.
    const existing = transcript.trim();
    setListening(true);
    ctrlRef.current = await startListening(speechCode, {
      onPartial: (text) => setTranscript([existing, text].filter(Boolean).join(" ")),
      onFinal: (text) => {
        const merged = [existing, text].filter(Boolean).join(" ").trim();
        if (merged) setTranscript(merged);
        setListening(false);
      },
      onError: (err) => {
        setMicError(explain(err));
        setListening(false);
      },
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

  // Photo-only path: no words needed — Gemini vision identifies the craft from
  // the enhanced photo and drafts the (editable) listing.
  async function describeFromPhoto() {
    setBusy(true);
    try {
      const listing = await generateListing({ transcript: "", language: lang, image_b64: imageB64 });
      setSource?.(getLastSource());
      onDone("", listing);
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
        <p className="text-clay-600 font-medium text-center">
          {listening ? t("listening", lang) : supported ? t("tapMic", lang) : t("orType", lang)}
        </p>
        {listening && (
          <p className="text-clay-400 text-xs text-center -mt-4">
            {t("micKeepTalking", lang)} · {t("micStop", lang)}
          </p>
        )}

        {(micError || langMissing) && !listening && (
          <p className="text-sm text-clay-700 bg-haldi/15 border border-haldi/40 rounded-2xl px-4 py-3 text-center -mt-2">
            {t(micError || "micLangMissing", lang)}
          </p>
        )}

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

      {imageB64 && (
        <>
          <div className="flex items-center gap-3 my-3">
            <span className="h-px flex-1 bg-clay-200" />
            <span className="text-xs text-clay-400">{t("orLabel", lang)}</span>
            <span className="h-px flex-1 bg-clay-200" />
          </div>
          <button className="btn-ghost !mt-0" onClick={describeFromPhoto}>
            ✨ {t("aiDescribe", lang)}
          </button>
        </>
      )}
    </div>
  );
}
