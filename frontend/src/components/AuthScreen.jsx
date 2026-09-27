import React, { useState } from "react";
import { t } from "../lib/i18n";
import {
  isFirebaseConfigured,
  signInWithGoogle,
  startPhoneSignIn,
  demoAccount,
} from "../lib/auth";

// Login / create-account, gating the seller flow. Three ways in: Google, phone
// OTP, and a "Skip for now (demo)" link. Stage insurance: ANY failure (no
// Firebase config, popup blocked, bad OTP) falls back to a local demo account,
// so a misconfig can never block the demo.

export default function AuthScreen({ lang, onDone }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // The provider's own error. "Sign-in failed" alone is useless to a user and
  // to us — Google's codes are specific (10 = SHA-1/client mismatch,
  // 12501 = cancelled, 7 = network) and worth showing.
  const [errDetail, setErrDetail] = useState("");
  const [mode, setMode] = useState("choose"); // choose | phone | otp
  const [phone, setPhone] = useState("+91");
  const [code, setCode] = useState("");
  const [confirmer, setConfirmer] = useState(null);

  const configured = isFirebaseConfigured();

  function finish(account) {
    onDone(account);
  }

  async function google() {
    setErr("");
    setErrDetail("");
    if (!configured) return finish(demoAccount());
    setBusy(true);
    try {
      finish(await signInWithGoogle());
    } catch (e) {
      setErr(t("authError", lang));
      setErrDetail(String(e?.message || e?.code || e || "").slice(0, 160));
    } finally {
      setBusy(false);
    }
  }

  async function sendCode() {
    setErr("");
    if (!configured) return finish(demoAccount());
    setBusy(true);
    try {
      const c = await startPhoneSignIn(phone.trim(), "recaptcha-host");
      setConfirmer(() => c);
      setMode("otp");
    } catch (e) {
      // Distinguish "this platform can't do phone OTP" from "the code was
      // wrong" — they need completely different things from the user.
      setErr(
        String(e?.message || "").includes("phone-otp-not-available-on-device")
          ? t("phoneWebOnly", lang)
          : t("authError", lang),
      );
      setMode("choose");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setErr("");
    setBusy(true);
    try {
      finish(await confirmer.confirm(code.trim()));
    } catch {
      setErr(t("authError", lang));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col min-h-full px-6 pt-12 pb-10 safe-top safe-bottom fade-in">
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        {/* The real artwork, same asset as the launcher icon and Welcome. This
            screen was drawing a hand-made approximation of the mark long after
            the real one landed, so it was the only screen with a different K. */}
        <img src="/icon-512.png" alt="" width={64} height={64} className="h-16 w-16 rounded-2xl shadow-soft mb-5" />
        <h1 className="text-2xl font-extrabold text-clay-900">{t("signIn", lang)}</h1>
        <p className="mt-2 text-clay-600 text-sm max-w-xs">{t("signInSub", lang)}</p>
      </div>

      <div className="space-y-3">
        {err && (
          <div className="text-center">
            <p className="text-sm text-red-600">{err}</p>
            {errDetail && (
              <p className="mt-1 text-[11px] text-clay-400 font-mono break-all px-2">{errDetail}</p>
            )}
          </div>
        )}

        {/*
          Without VITE_FIREBASE_* the Google and phone buttons quietly created a
          local demo account — they looked like real sign-in, never contacted
          Google, and dropped you on the demo screen. The fallback is deliberate
          stage insurance, but it has to announce itself rather than imply an
          authentication that never happened.
        */}
        {!configured && (
          <div className="rounded-2xl bg-haldi/15 px-4 py-3 text-[13px] text-clay-800">
            {t("authDemoNotice", lang)}
          </div>
        )}

        {mode === "choose" && (
          <>
            <button className="btn-primary !bg-white !text-clay-800 border-2 border-clay-200" disabled={busy} onClick={google}>
              {/* Google's own G, at its published geometry. The previous paths
                  were hand-approximated and did not line up — the green arc
                  carried a stray absolute `H4.2` that pulled it off-centre, so
                  the mark rendered visibly broken. It ALSO sat on the text
                  baseline, because .btn-primary was a block box and mr-3 had
                  no flex container to act in — see index.css. Brand guidelines
                  make this worth getting exactly right on a sign-in button. */}
              <svg viewBox="0 0 48 48" className="h-5 w-5 shrink-0" aria-hidden="true">
                <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
                <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
                <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z" />
                <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
              </svg>
              {t("continueGoogle", lang)}
            </button>
            <button className="btn-primary" disabled={busy} onClick={() => setMode("phone")}>
              📱 {t("continuePhone", lang)}
            </button>
          </>
        )}

        {mode === "phone" && (
          <>
            <label className="block text-sm font-medium text-clay-700">{t("phoneNumber", lang)}</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              className="w-full rounded-2xl border-2 border-clay-200 px-4 py-3 text-clay-900 outline-none focus:border-clay-500"
            />
            <button className="btn-primary" disabled={busy} onClick={sendCode}>
              {busy ? t("signingIn", lang) : t("sendCode", lang)}
            </button>
          </>
        )}

        {mode === "otp" && (
          <>
            <label className="block text-sm font-medium text-clay-700">{t("enterCode", lang)}</label>
            <input
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              className="w-full rounded-2xl border-2 border-clay-200 px-4 py-3 text-clay-900 text-center tracking-[0.4em] outline-none focus:border-clay-500"
            />
            <button className="btn-primary" disabled={busy} onClick={verify}>
              {busy ? t("signingIn", lang) : t("verify", lang)}
            </button>
          </>
        )}

        {/* invisible reCAPTCHA host for phone OTP */}
        <div id="recaptcha-host" />

        <button
          onClick={() => finish(demoAccount())}
          className="w-full text-center text-sm text-clay-500 py-3 font-medium"
        >
          {t("skipDemo", lang)}
        </button>

        {!configured && (
          <p className="text-center text-[11px] text-clay-400">
            Demo mode · set VITE_FIREBASE_* to enable real sign-in
          </p>
        )}
      </div>
    </div>
  );
}
