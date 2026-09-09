import React, { useEffect, useState } from "react";
import { t } from "../lib/i18n";
import { apiBase, setApiBase, checkHealth, forcedDemo, isNativeApp } from "../lib/api";

// Why this screen exists:
//
// On a real Android phone there is no JS console, so the documented
// `localStorage.setItem('karigar_api_base', ...)` trick needs USB remote
// debugging — useless when a judge is holding the device. The native default
// (10.0.2.2) only resolves inside the emulator. Without an in-app way to point
// the app at the laptop, the APK cannot reach the backend at all.
//
// It also surfaces the offline-demo switch, which had the same problem: it was
// only reachable from a console.

function StatusLine({ state, lang }) {
  if (state.phase === "checking") {
    return <p className="text-sm text-clay-500 mt-3">{t("checking", lang)}</p>;
  }
  if (state.phase === "ok") {
    return (
      <p className="text-sm text-leaf font-medium mt-3">
        ● {t("connected", lang)} — <span className="text-clay-500 font-normal">{state.mode}</span>
      </p>
    );
  }
  if (state.phase === "fail") {
    return (
      <p className="text-sm text-red-600 font-medium mt-3">
        {t("unreachable", lang)} <span className="text-clay-400 font-normal">({state.error})</span>
      </p>
    );
  }
  return null;
}

export default function ConnectSheet({ lang, onClose }) {
  const [url, setUrl] = useState(() => apiBase());
  const [state, setState] = useState({ phase: "idle" });
  const [demo, setDemo] = useState(() => forcedDemo());

  async function test(target) {
    setState({ phase: "checking" });
    const res = await checkHealth(target);
    setState({ phase: res.ok ? "ok" : "fail", ...res });
  }

  // Probe whatever is currently configured as soon as the sheet opens, so the
  // first thing you see is whether you are actually connected.
  useEffect(() => {
    if (!forcedDemo()) test(apiBase());
  }, []);

  function save() {
    const clean = setApiBase(url);
    setUrl(clean || apiBase());
    test(clean || apiBase());
  }

  function toggleDemo(next) {
    try {
      if (next) localStorage.setItem("karigar_demo", "1");
      else localStorage.removeItem("karigar_demo");
    } catch {}
    setDemo(next);
    if (!next) test(apiBase());
  }

  return (
    <div className="absolute inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-clay-900/40" onClick={onClose} />

      <div className="relative w-full bg-clay-50 rounded-t-3xl sm:rounded-3xl p-5 pb-8 shadow-soft max-h-full overflow-y-auto fade-in">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-clay-900">{t("connection", lang)}</h2>
            <p className="text-sm text-clay-600 mt-1">{t("connectionSub", lang)}</p>
          </div>
          <button onClick={onClose} className="text-clay-500 text-sm font-medium px-2 py-1">
            {t("close", lang)}
          </button>
        </div>

        <div className="card p-4 mt-5">
          <label className="text-xs font-semibold tracking-wide text-clay-500 uppercase">
            {t("serverAddress", lang)}
          </label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="http://192.168.1.42:8000"
            disabled={demo}
            className="w-full mt-2 rounded-2xl border-2 border-clay-200 bg-white px-4 py-3 text-base
                       text-clay-900 disabled:opacity-50 focus:border-clay-600 focus:outline-none"
          />
          <p className="text-xs text-clay-500 mt-2 leading-snug">{t("connectHint", lang)}</p>

          {!demo && <StatusLine state={state} lang={lang} />}

          <div className="flex gap-3 mt-4">
            <button
              className="btn-ghost !py-2.5 flex-1"
              onClick={() => test(url)}
              disabled={demo || state.phase === "checking"}
            >
              {t("testConnection", lang)}
            </button>
            <button className="btn-primary !py-2.5 !text-base flex-1" onClick={save} disabled={demo}>
              {t("save", lang)}
            </button>
          </div>
        </div>

        <div className="card p-4 mt-4 flex items-start gap-3">
          <input
            id="demo-toggle"
            type="checkbox"
            checked={demo}
            onChange={(e) => toggleDemo(e.target.checked)}
            className="mt-1 h-5 w-5 accent-clay-600 flex-none"
          />
          <label htmlFor="demo-toggle" className="flex-1">
            <span className="font-semibold text-clay-900 text-sm">{t("offlineDemo", lang)}</span>
            <span className="block text-xs text-clay-500 mt-0.5 leading-snug">
              {t("offlineDemoSub", lang)}
            </span>
          </label>
        </div>

        {isNativeApp() && (
          <p className="text-[11px] text-clay-400 mt-4 text-center leading-snug">
            Emulator: http://10.0.2.2:8000 · Real device: your laptop's Wi-Fi address
          </p>
        )}
      </div>
    </div>
  );
}
