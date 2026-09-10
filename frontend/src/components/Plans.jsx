import React, { useState } from "react";
import { t } from "../lib/i18n";
import { upsertArtisan } from "../lib/api";

// Free vs Karigar Pro. Upgrade sets the plan flag (no real charge) — live
// Google Play Billing is a post-hackathon step, stated honestly here.

// Free covers everything an artisan needs to actually sell. Listing is never
// capped — charging someone to list their first product would kill adoption,
// which is exactly the answer we give judges. Pro buys reach, not permission.
const FREE = [
  "Unlimited listings — always free",
  "AI listings in 9 languages",
  "Grounded fair-price + GI verification",
  "Publish to ONDC + QR storefront",
];
const PRO = [
  "Publish to every channel at once",
  "Meesho, Myntra, Amazon Karigar, Flipkart Samarth, WhatsApp",
  "Priority pricing insights + market trends",
  "Sales analytics dashboard",
  "Priority support",
];

export default function Plans({ lang, account, setAccount, onBack }) {
  const [plan, setPlan] = useState(account?.plan || "free");
  const [busy, setBusy] = useState(false);

  async function upgrade() {
    setBusy(true);
    await upsertArtisan({ uid: account?.uid, plan: "pro" });
    setPlan("pro");
    setAccount({ ...account, plan: "pro" });
    setBusy(false);
  }

  return (
    <div className="flex flex-col min-h-full px-5 pt-4 pb-8 safe-top safe-bottom fade-in">
      <button onClick={onBack} className="text-clay-700 text-sm font-medium self-start">
        ← {t("back", lang)}
      </button>

      <h2 className="text-2xl font-extrabold text-clay-900 mt-4">{t("plans", lang)}</h2>

      {/* Free */}
      <div className="card p-5 mt-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-clay-900">Free</h3>
          {plan === "free" && <span className="chip !bg-clay-100 !text-clay-600 !py-0.5 text-[11px]">{t("currentPlan", lang)}</span>}
        </div>
        <ul className="mt-3 space-y-1.5 text-sm text-clay-700">
          {FREE.map((f) => <li key={f}>✓ {f}</li>)}
        </ul>
      </div>

      {/* Pro */}
      <div className="card p-5 mt-4 border-2 border-haldi/60 relative overflow-hidden">
        <div className="absolute top-0 right-0 bg-haldi text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl">PRO</div>
        <div className="flex items-baseline gap-2">
          <h3 className="text-lg font-bold text-clay-900">Karigar Pro</h3>
          <span className="text-sm text-clay-500">₹199/mo</span>
        </div>
        <ul className="mt-3 space-y-1.5 text-sm text-clay-700">
          {PRO.map((f) => <li key={f}>⭐ {f}</li>)}
        </ul>

        {plan === "pro" ? (
          <p className="mt-4 text-center font-semibold text-leaf">{t("proActive", lang)}</p>
        ) : (
          <button className="btn-primary mt-4 !bg-haldi" disabled={busy} onClick={upgrade}>
            {t("upgradePro", lang)}
          </button>
        )}
        <p className="text-[11px] text-clay-400 text-center mt-3">{t("billingSoon", lang)}</p>
      </div>
    </div>
  );
}
