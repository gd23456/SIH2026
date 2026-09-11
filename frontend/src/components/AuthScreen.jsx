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
              <svg viewBox="0 0 48 48" className="h-5 w-5 mr-3 shrink-0" aria-hidden="true">
                <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.1-3.8 6.6-9.4 6.6-16.1z" />
                <path fill="#34A853" d="M24 46c6 0 11-2 14.6-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.7-3.9-12.4-9.750H4.2v5.7C7.8 40.9 15.3 46 24 46z" />
                <path fill="#FBBC05" d="M11.6 27.45c-.45-1.3-.7-2.7-.7-4.15s.25-2.85.7-4.15V13.45H4.2A22 22 0 0 0 2 23.3c0 3.55.85 6.9 2.2 9.85l7.4-5.7z" />
                <path fill="#EA4335" d="M24 10.15c3.3 0 6.2 1.15 8.5 3.35l6.3-6.3C35 3.6 30 1.5 24 1.5 15.3 1.5 7.8 6.6 4.2 13.45l7.4 5.7C13.3 14.05 18.2 10.15 24 10.15z" />
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
