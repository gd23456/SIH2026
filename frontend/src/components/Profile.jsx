import React, { useEffect, useState } from "react";
import { t } from "../lib/i18n";
import { Avatar, Spinner } from "./ui";
import { getArtisan, upsertArtisan, listChannels, connectChannel } from "../lib/api";
import { signOut } from "../lib/auth";

// The profile hub — "one place for everything": who you are, the channels you
// sell on, your listing count, your plan, and sign-out. Fully functional in
// demo mode (shows the demo account).

function ChannelRow({ ch, lang, onConnect, busy }) {
  const live = ch.kind === "live";
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="text-xl w-7 text-center">{ch.logo}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-clay-900">{ch.name}</p>
        {live ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-leaf">● {t("liveChannel", lang)}</span>
        ) : ch.connected ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-clay-500">✓ {t("demoConnection", lang)}</span>
        ) : (
          <span className="text-[10px] text-clay-400">{ch.note}</span>
        )}
      </div>
      {live ? (
        <span className="chip !bg-leaf/15 !text-leaf !py-0.5 text-[10px]">{t("liveChannel", lang)}</span>
      ) : ch.connected ? (
        <span className="chip !bg-haldi/20 !text-clay-700 !py-0.5 text-[10px]">{t("demoConnection", lang)}</span>
      ) : (
        <button
          disabled={busy}
          onClick={() => onConnect(ch.id)}
          className="text-xs font-semibold text-clay-700 border border-clay-300 rounded-full px-3 py-1 active:scale-95"
        >
          {t("connect", lang)}
        </button>
      )}
    </div>
  );
}

export default function Profile({ lang, account, setAccount, onBack, onMyProducts, onPlans, onPrivacy, onSignedOut }) {
  const [server, setServer] = useState(null);
  const [channels, setChannels] = useState(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(account?.name || "");
  const [location, setLocation] = useState("");
  const [busyCh, setBusyCh] = useState(false);

  const uid = account?.uid;

  useEffect(() => {
    let alive = true;
    (async () => {
      if (uid) {
        const a = await getArtisan(uid);
        if (alive && a) {
          setServer(a);
          setName(a.name || account?.name || "");
          setLocation(a.location || "");
        }
      }
      const chs = await listChannels(uid || "");
      if (alive) setChannels(Array.isArray(chs) ? chs : []);
    })();
    return () => {
      alive = false;
    };
  }, [uid]);

  async function save() {
    setEditing(false);
    const updated = await upsertArtisan({ uid, name, location });
    setServer(updated);
    setAccount({ ...account, name });
  }

  async function connect(channelId) {
    setBusyCh(true);
    await connectChannel(channelId, { uid, name: account?.name });
    setChannels((cs) => cs.map((c) => (c.id === channelId ? { ...c, connected: true } : c)));
    setBusyCh(false);
  }

  async function doSignOut() {
    await signOut();
    onSignedOut();
  }

  const plan = server?.plan || account?.plan || "free";
  const listingCount = server?.listing_count ?? 0;

  return (
    <div className="flex flex-col min-h-full px-5 pt-4 pb-8 safe-top safe-bottom fade-in">
      <button onClick={onBack} className="text-clay-700 text-sm font-medium self-start">
        ← {t("back", lang)}
      </button>

      {/* identity */}
      <div className="flex flex-col items-center text-center mt-4">
        <Avatar account={account} size={80} />
        <h2 className="text-xl font-extrabold text-clay-900 mt-3">{account?.name || "Artisan"}</h2>
        {account?.email && <p className="text-sm text-clay-500">{account.email}</p>}
        {account?.phone && <p className="text-sm text-clay-500">{account.phone}</p>}
        {account?.demo && (
          <span className="chip !bg-haldi/20 !text-clay-700 !py-0.5 text-[11px] mt-2">{t("demoAccount", lang)}</span>
        )}
      </div>

      {/* editable name / location */}
      <div className="card p-4 mt-5">
        {editing ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-clay-500">{t("yourName", lang)}</label>
              <input value={name} onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border-2 border-clay-200 px-3 py-2 text-clay-900 outline-none focus:border-clay-500" />
            </div>
            <div>
              <label className="text-xs text-clay-500">{t("yourLocation", lang)}</label>
              <input value={location} onChange={(e) => setLocation(e.target.value)}
                className="w-full rounded-xl border-2 border-clay-200 px-3 py-2 text-clay-900 outline-none focus:border-clay-500" />
            </div>
            <button className="btn-primary !mt-1" onClick={save}>{t("save", lang)}</button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-clay-900 font-semibold">{name || account?.name}</p>
              <p className="text-sm text-clay-500">{location || "—"}</p>
            </div>
            <button onClick={() => setEditing(true)} className="text-xs font-semibold text-clay-700 border border-clay-300 rounded-full px-3 py-1">
              {t("edit", lang)}
            </button>
          </div>
        )}
      </div>

      {/* my products + plan */}
      <div className="grid grid-cols-2 gap-3 mt-3">
        <button onClick={onMyProducts} className="card p-4 text-left active:scale-[0.98] transition">
          <p className="text-2xl font-extrabold text-clay-800">{listingCount}</p>
          <p className="text-xs text-clay-500">{t("myProducts", lang)}</p>
        </button>
        <button onClick={onPlans} className="card p-4 text-left active:scale-[0.98] transition">
          <p className="text-lg font-extrabold text-clay-800">
            {plan === "pro" ? "Karigar Pro" : "Free"}
          </p>
          <p className="text-xs text-clay-500">{t("plan", lang)}</p>
        </button>
      </div>

      {/* channels */}
      <div className="card p-4 mt-3">
        <p className="font-semibold text-clay-800 mb-1">{t("yourChannels", lang)}</p>
        {channels === null ? (
          <Spinner label="…" />
        ) : (
          <div className="divide-y divide-clay-100">
            {channels.map((ch) => (
              <ChannelRow key={ch.id} ch={ch} lang={lang} onConnect={connect} busy={busyCh} />
            ))}
          </div>
        )}
      </div>

      <button onClick={onPrivacy} className="text-center text-xs text-clay-500 py-3 font-medium mt-2">
        {t("privacy", lang)}
      </button>
      <button onClick={doSignOut} className="btn-ghost !text-red-600">
        {t("signOut", lang)}
      </button>
    </div>
  );
}
