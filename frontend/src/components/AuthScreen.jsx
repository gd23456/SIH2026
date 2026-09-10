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
    if (!configured) return finish(demoAccount());
    setBusy(true);
    try {
      finish(await signInWithGoogle());
    } catch {
      setErr(t("authError", lang));
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
    } catch {
      setErr(t("authError", lang));
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
        {/* Same K mark as the launcher icon and the welcome screen — the
            sign-in screen was the one place still showing a basket emoji. */}
        <div className="h-16 w-16 rounded-2xl bg-clay-600 shadow-soft flex items-center justify-center mb-5">
          <svg viewBox="0 0 512 512" className="h-11 w-11">
            <g fill="none" stroke="#faf6f0" strokeWidth="30" strokeLinecap="round">
              <path d="M176 128 V384" />
              <path d="M176 256 L336 128" />
              <path d="M176 256 L336 384" />
            </g>
            <circle cx="336" cy="128" r="22" fill="#e8a13a" />
          </svg>
        </div>
        <h1 className="text-2xl font-extrabold text-clay-900">{t("signIn", lang)}</h1>
        <p className="mt-2 text-clay-600 text-sm max-w-xs">{t("signInSub", lang)}</p>
      </div>

      <div className="space-y-3">
        {err && <p className="text-center text-sm text-red-600">{err}</p>}

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
              <span className="mr-2">🔵</span> {t("continueGoogle", lang)}
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
