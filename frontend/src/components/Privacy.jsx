import React from "react";
import { t } from "../lib/i18n";

// A simple in-app privacy page. Play Store requires a reachable privacy policy;
// the canonical text also lives in docs/PRIVACY.md.

export default function Privacy({ lang, onBack }) {
  return (
    <div className="flex flex-col min-h-full px-5 pt-4 pb-8 safe-top safe-bottom fade-in">
      <button onClick={onBack} className="text-clay-700 text-sm font-medium self-start">
        ← {t("back", lang)}
      </button>

      <h2 className="text-2xl font-extrabold text-clay-900 mt-4">{t("privacy", lang)}</h2>

      <div className="card p-5 mt-4 text-sm text-clay-700 leading-relaxed space-y-3">
        <p><b>What we collect.</b> Your name, and (if you sign in) your Google email
        or phone number and profile photo, plus the product listings and photos you create.</p>
        <p><b>Why.</b> To create your account, publish your products to ONDC, and show
        your catalogue back to you across devices.</p>
        <p><b>What we don't do.</b> We never sell your data, and we never ask for or
        store passwords for any other marketplace. Third-party channels shown as
        "demo" do not receive your data.</p>
        <p><b>Your photos & listings</b> are stored to power your storefront and can be
        removed on request.</p>
        <p><b>Contact.</b> For any data request, contact the Karigar AI team.</p>
        <p className="text-clay-400 text-xs">This is a hackathon prototype; the production
        policy will be finalised before any public Play Store release.</p>
      </div>
    </div>
  );
}
