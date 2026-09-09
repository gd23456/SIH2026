// Speech-to-text that works in two worlds:
//  - Native Android (Capacitor): @capacitor-community/speech-recognition
//    (uses Android's native SpeechRecognizer — supports hi-IN, kn-IN, en-IN).
//  - Web / dev (Chrome): the Web Speech API.
// Both expose the same tiny interface. If neither is available, callers fall
// back to the text input.

function isNative() {
  return typeof window !== "undefined" && window.Capacitor?.isNativePlatform?.();
}

export function speechSupported() {
  if (isNative()) return true;
  return typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
}

/**
 * Start listening.
 * @returns {Promise<{stop: () => Promise<void>}>} controller
 * Callbacks: onPartial(text), onFinal(text), onError(err)
 */
export async function startListening(langSpeech, { onPartial, onFinal, onError }) {
  if (isNative()) {
    return startNative(langSpeech, { onPartial, onFinal, onError });
  }
  return startWeb(langSpeech, { onPartial, onFinal, onError });
}

async function startNative(lang, { onPartial, onFinal, onError }) {
  try {
    const { SpeechRecognition } = await import("@capacitor-community/speech-recognition");
    const perm = await SpeechRecognition.requestPermissions();
    if (perm?.speechRecognition && perm.speechRecognition !== "granted") {
      onError?.("permission-denied");
      return { stop: async () => {} };
    }
    let last = "";
    const handle = await SpeechRecognition.addListener("partialResults", (data) => {
      const text = data?.matches?.[0] || "";
      if (text) {
        last = text;
        onPartial?.(text);
      }
    });
    await SpeechRecognition.start({
      language: lang || "en-IN",
      maxResults: 3,
      partialResults: true,
      popup: false,
    });
    return {
      stop: async () => {
        try {
          await SpeechRecognition.stop();
        } catch {}
        try {
          await handle.remove();
        } catch {}
        onFinal?.(last);
      },
    };
  } catch (e) {
    onError?.(e?.message || "native-speech-failed");
    return { stop: async () => {} };
  }
}

function startWeb(lang, { onPartial, onFinal, onError }) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    onError?.("unsupported");
    return { stop: async () => {} };
  }
  const rec = new SR();
  rec.lang = lang || "en-IN";
  rec.interimResults = true;
  rec.continuous = true;
  let finalText = "";
  rec.onresult = (ev) => {
    let interim = "";
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const chunk = ev.results[i][0].transcript;
      if (ev.results[i].isFinal) finalText += chunk + " ";
      else interim += chunk;
    }
    onPartial?.((finalText + interim).trim());
  };
  rec.onerror = (e) => onError?.(e.error || "web-speech-error");
  rec.onend = () => onFinal?.(finalText.trim());
  rec.start();
  return {
    stop: async () => {
      try {
        rec.stop();
      } catch {}
    },
  };
}
