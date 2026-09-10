// Speech-to-text that works in two worlds:
//  - Native Android (Capacitor): @capacitor-community/speech-recognition
//    (uses Android's native SpeechRecognizer — supports hi-IN, kn-IN, en-IN…).
//  - Web / dev (Chrome): the Web Speech API.
// Both expose the same tiny interface. If neither is available, callers fall
// back to the text input.
//
// ---------------------------------------------------------------------------
// CONTINUOUS LISTENING — why this file is more complicated than it looks
//
// Android's SpeechRecognizer is a *one-utterance* API. It ends itself after a
// couple of seconds of silence and there is no supported way to turn that off:
// the EXTRA_SPEECH_INPUT_*_SILENCE_LENGTH_MILLIS extras are advisory and most
// OEM recognisers ignore them. An artisan describing a product pauses to think,
// so a raw start() call captures the first few words and quits.
//
// Worse, when the recogniser ends on its own the plugin stays in its "started"
// state until something calls stop(). The next start() is then rejected, which
// is why the mic button appeared dead after the first use.
//
// So this module owns a small state machine:
//   - `wanted` tracks whether the USER still wants to be listening,
//   - every native session's text is pushed onto `segments`,
//   - on the plugin's 'listeningState: stopped' we restart while `wanted`,
//   - stop() is always called before start(), and listeners are always removed.
// The caller just sees one long, continuous transcript.
// ---------------------------------------------------------------------------

function isNative() {
  return typeof window !== "undefined" && window.Capacitor?.isNativePlatform?.();
}

export function speechSupported() {
  if (isNative()) return true;
  return typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
}

/**
 * Languages this device's recogniser actually supports.
 *
 * Android 13+ no longer answers this query, and Google's recogniser only
 * handles a language once its pack is installed — so an empty array means
 * "could not determine", NOT "nothing is supported". Callers must treat it as
 * advisory and never block input on it.
 *
 * @returns {Promise<string[]>} BCP-47 tags, or [] when unknown.
 */
export async function supportedLanguages() {
  if (!isNative()) return [];
  try {
    const { SpeechRecognition } = await import("@capacitor-community/speech-recognition");
    const res = await SpeechRecognition.getSupportedLanguages();
    const list = Array.isArray(res?.languages) ? res.languages : [];
    return list.map((l) => String(l?.value ?? l)).filter(Boolean);
  } catch {
    return [];
  }
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

/** Join completed segments with the in-flight one into a single transcript. */
function joinText(segments, current) {
  return [...segments, current].map((s) => (s || "").trim()).filter(Boolean).join(" ");
}

async function startNative(lang, { onPartial, onFinal, onError }) {
  let SpeechRecognition;
  try {
    ({ SpeechRecognition } = await import("@capacitor-community/speech-recognition"));
  } catch (e) {
    onError?.(e?.message || "native-speech-unavailable");
    return { stop: async () => {} };
  }

  // Always leave the plugin in a clean state before starting. Without this a
  // session that ended by itself (silence timeout, or the user backing out of
  // the step mid-listen) leaves the plugin "started" and every later start()
  // fails silently — the dead-mic-button bug.
  async function reset() {
    try {
      await SpeechRecognition.removeAllListeners();
    } catch {}
    try {
      if ((await SpeechRecognition.isListening())?.listening) await SpeechRecognition.stop();
    } catch {
      // isListening is only in plugin >= 5.1; stop() unconditionally as a fallback.
      try {
        await SpeechRecognition.stop();
      } catch {}
    }
  }

  await reset();

  try {
    const perm = await SpeechRecognition.requestPermissions();
    if (perm?.speechRecognition && perm.speechRecognition !== "granted") {
      onError?.("permission-denied");
      return { stop: async () => {} };
    }
  } catch {
    // Some ROMs throw here even when the permission is fine. Push on: start()
    // will fail with a clearer error if the permission really is missing.
  }

  const segments = [];   // text from finished recogniser sessions
  let current = "";      // text from the session in flight
  let wanted = true;     // does the USER still want to be listening?
  let restarting = false;
  const handles = [];

  try {
    handles.push(
      await SpeechRecognition.addListener("partialResults", (data) => {
        const text = data?.matches?.[0] || "";
        if (!text) return;
        current = text;
        onPartial?.(joinText(segments, current));
      }),
    );

    handles.push(
      await SpeechRecognition.addListener("listeningState", (data) => {
        if (data?.status !== "stopped") return;
        // Android ended the utterance. Bank whatever it heard and, if the user
        // has not pressed stop, immediately open another session so a pause for
        // thought does not end the recording.
        if (current.trim()) segments.push(current.trim());
        current = "";
        if (wanted) restart();
      }),
    );
  } catch (e) {
    onError?.(e?.message || "listener-failed");
    return { stop: async () => {} };
  }

  async function begin() {
    await SpeechRecognition.start({
      language: lang || "en-IN",
      maxResults: 3,
      partialResults: true,
      popup: false,
    });
  }

  async function restart() {
    if (restarting || !wanted) return;
    restarting = true;
    // A short breath before restarting: back-to-back start() calls on the same
    // recogniser are refused by several OEM implementations.
    await new Promise((r) => setTimeout(r, 250));
    if (!wanted) {
      restarting = false;
      return;
    }
    try {
      await begin();
    } catch (e) {
      // ERROR_RECOGNIZER_BUSY and friends: one retry, then surface it rather
      // than spinning forever.
      try {
        await new Promise((r) => setTimeout(r, 600));
        if (wanted) await begin();
      } catch (err) {
        wanted = false;
        onError?.(err?.message || e?.message || "restart-failed");
        onFinal?.(joinText(segments, current));
      }
    } finally {
      restarting = false;
    }
  }

  try {
    await begin();
  } catch (e) {
    wanted = false;
    await reset();
    // The most common cause by far is no language pack for this locale.
    onError?.(e?.message || "start-failed");
    return { stop: async () => {} };
  }

  return {
    stop: async () => {
      wanted = false;
      try {
        await SpeechRecognition.stop();
      } catch {}
      for (const h of handles) {
        try {
          await h.remove();
        } catch {}
      }
      try {
        await SpeechRecognition.removeAllListeners();
      } catch {}
      const text = joinText(segments, current);
      segments.length = 0;
      current = "";
      onFinal?.(text);
    },
  };
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
  let wanted = true;

  rec.onresult = (ev) => {
    let interim = "";
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const chunk = ev.results[i][0].transcript;
      if (ev.results[i].isFinal) finalText += chunk + " ";
      else interim += chunk;
    }
    onPartial?.((finalText + interim).trim());
  };

  rec.onerror = (e) => {
    // "no-speech" and "aborted" are routine on a pause — they should not tear
    // the session down, they should let onend restart it.
    if (e.error === "no-speech" || e.error === "aborted") return;
    wanted = false;
    onError?.(e.error || "web-speech-error");
  };

  // Chrome also ends `continuous` recognition on a long silence. Same fix as
  // Android: restart while the user still wants to be listening.
  rec.onend = () => {
    if (wanted) {
      try {
        rec.start();
        return;
      } catch {
        /* fall through to finalising */
      }
    }
    onFinal?.(finalText.trim());
  };

  rec.start();
  return {
    stop: async () => {
      wanted = false;
      try {
        rec.stop();
      } catch {}
    },
  };
}
