import React, { useState } from "react";
import { LANGS, t } from "../lib/i18n";
import { HelpLink, Icon } from "./ui";

// The catalogue the AI drafted — and the artisan's chance to own it.
//
// Every piece says where it came from, because an artisan who can't tell
// what the AI invented can't vouch for it to a buyer:
//   AI-written          drafted by AI, not yet touched
//   Your words          what they said, or anything they edited
//   Verified            checked against an authoritative source (GI registry)
//   Pending             a claim nobody has verified yet (possible GI)
//   Sample text         the AI couldn't be reached; this is placeholder copy
// Anything can be edited; an edited field is marked and published as such.

const DETAIL_FIELDS = [
  { key: "material", label: "material" },
  { key: "category", label: "category" },
  { key: "craft_technique", label: "technique" },
  { key: "production_time", label: "time" },
  { key: "dimensions", label: "fldSize" },
];

export function Provenance({ kind, lang }) {
  const map = {
    ai: { cls: "bg-clay-100 text-clay-700", icon: "sparkles", key: "provAi" },
    yours: { cls: "bg-indigo-brand/10 text-indigo-brand", icon: "check", key: "provYours" },
    verified: { cls: "bg-leaf/15 text-leaf", icon: "check", key: "provVerified" },
    pending: { cls: "bg-haldi/20 text-haldi-ink", icon: "alert", key: "provPending" },
    sample: { cls: "bg-red-50 text-red-700", icon: "alert", key: "provSample" },
  }[kind];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${map.cls}`}>
      <Icon name={map.icon} size={11} strokeWidth={2.5} />
      {t(map.key, lang)}
    </span>
  );
}

export function textProvenance(field, edited, sample) {
  if (edited.includes(field)) return "yours";
  return sample ? "sample" : "ai";
}

function Input({ label, value, onChange, multiline = false, id }) {
  const cls =
    "w-full rounded-xl border-2 border-clay-200 bg-white px-3 py-2.5 text-[15px] text-clay-900 outline-none focus:border-clay-500";
  return (
    <label htmlFor={id} className="block">
      <span className="text-xs font-semibold text-clay-600">{label}</span>
      {multiline ? (
        <textarea id={id} rows={5} value={value} onChange={(e) => onChange(e.target.value)} className={`${cls} mt-1 resize-y leading-relaxed`} />
      ) : (
        <input id={id} value={value} onChange={(e) => onChange(e.target.value)} className={`${cls} mt-1`} />
      )}
    </label>
  );
}

export default function ReviewStep({ lang, listing, setListing, edited = [], setEdited, transcript = "", imageB64, onDone, onHelp }) {
  const [view, setView] = useState(lang);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const sample = Boolean(listing._sample);

  const title = listing.title?.[view] || listing.title?.en || "";
  const desc = listing.description?.[view] || listing.description?.en || "";

  function startEdit() {
    setDraft({
      title,
      description: desc,
      tags: (listing.tags || []).join(", "),
      ...Object.fromEntries(DETAIL_FIELDS.map((f) => [f.key, listing[f.key] || ""])),
    });
    setEditing(true);
  }

  function saveEdit() {
    const changed = new Set(edited);
    const next = { ...listing };
    if (draft.title.trim() !== title) {
      next.title = { ...listing.title, [view]: draft.title.trim() };
      changed.add("title");
    }
    if (draft.description.trim() !== desc) {
      next.description = { ...listing.description, [view]: draft.description.trim() };
      changed.add("description");
    }
    for (const f of DETAIL_FIELDS) {
      if ((draft[f.key] || "").trim() !== (listing[f.key] || "")) {
        next[f.key] = draft[f.key].trim();
        changed.add(f.key);
      }
    }
    const tags = draft.tags.split(",").map((x) => x.trim()).filter(Boolean);
    if (tags.join(",") !== (listing.tags || []).join(",")) {
      next.tags = tags;
      changed.add("tags");
    }
    setListing(next);
    setEdited([...changed]);
    setEditing(false);
  }

  return (
    <div className="flex flex-col min-h-full px-4 sm:px-5 pb-8">
      <h2 className="text-2xl font-bold text-clay-900 mt-3">{t("yourListing", lang)}</h2>
      <p className="text-sm text-clay-600 mt-1">{t("revEditHint", lang)}</p>

      {sample && edited.length === 0 && (
        <p className="mt-3 flex gap-2 text-sm text-red-800 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 leading-snug" role="status">
          <Icon name="alert" size={18} className="mt-0.5" />
          {t("revSampleBanner", lang)}
        </p>
      )}

      {transcript.trim() && (
        <figure className="mt-3 rounded-2xl bg-white border border-clay-100 px-4 py-3">
          <figcaption className="flex items-center justify-between">
            <span className="text-xs font-bold text-clay-600">{t("revYouSaid", lang)}</span>
            <Provenance kind="yours" lang={lang} />
          </figcaption>
          <blockquote className="mt-1 text-[15px] text-clay-800 italic leading-snug">“{transcript.trim()}”</blockquote>
        </figure>
      )}

      <div className="card overflow-hidden fade-in mt-3">
        {imageB64 && (
          <img src={`data:image/png;base64,${imageB64}`} alt="" className="w-full aspect-[4/3] object-cover" />
        )}
        <div className="p-5">
          <div className="flex flex-wrap gap-1.5 mb-3" role="tablist" aria-label={t("chooseLang", lang)}>
            {LANGS.map((l) => (
              <button
                key={l.code}
                role="tab"
                aria-selected={view === l.code}
                disabled={editing}
                onClick={() => setView(l.code)}
                className={`min-h-[32px] px-3 rounded-full text-xs font-semibold disabled:opacity-50 ${
                  view === l.code ? "bg-clay-600 text-white" : "bg-clay-100 text-clay-700"
                }`}
              >
                {l.native}
              </button>
            ))}
          </div>

          {editing ? (
            <div className="space-y-3">
              <Input id="ed-title" label={t("fldTitle", lang)} value={draft.title} onChange={(v) => setDraft({ ...draft, title: v })} />
              <Input id="ed-desc" label={t("fldDescription", lang)} value={draft.description} multiline onChange={(v) => setDraft({ ...draft, description: v })} />
              {DETAIL_FIELDS.map((f) => (
                <Input key={f.key} id={`ed-${f.key}`} label={t(f.label, lang)} value={draft[f.key]} onChange={(v) => setDraft({ ...draft, [f.key]: v })} />
              ))}
              <Input id="ed-tags" label={t("fldTags", lang)} value={draft.tags} onChange={(v) => setDraft({ ...draft, tags: v })} />
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button className="btn-ghost" onClick={() => setEditing(false)}>{t("cancel", lang)}</button>
                <button className="btn-primary" onClick={saveEdit}>{t("save", lang)}</button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-xl font-bold text-clay-900 leading-snug">{title}</h3>
                <button
                  onClick={startEdit}
                  data-tour="review-edit"
                  className="shrink-0 inline-flex items-center gap-1.5 min-h-[40px] rounded-full border-2 border-clay-300 px-3.5 text-sm font-bold text-clay-800 active:scale-95 transition"
                >
                  <Icon name="pencil" size={15} /> {t("edit", lang)}
                </button>
              </div>
              <div className="mt-1.5">
                <Provenance kind={textProvenance("title", edited, sample)} lang={lang} />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2" data-tour="gi-badge">
                {listing.gi_verified ? (
                  <>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-leaf/15 px-3 py-1 text-xs font-bold text-leaf">
                      ✓ {t("verifiedGi", lang)}
                      {listing.gi_registry_name && <span className="font-semibold">· {listing.gi_registry_name}</span>}
                    </span>
                    <Provenance kind="verified" lang={lang} />
                  </>
                ) : (
                  listing.gi_candidate && (
                    <>
                      <span className="chip !bg-haldi/20 !text-clay-800 !text-xs"><Icon name="tag" size={13} /> {t("giTag", lang)}: {listing.gi_candidate}</span>
                      <Provenance kind="pending" lang={lang} />
                    </>
                  )
                )}
              </div>
              {(listing.gi_verified || listing.gi_candidate) && onHelp && (
                <HelpLink label={t("whatIsGi", lang)} onClick={() => onHelp("gi")} className="!text-xs" />
              )}

              <div className="mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-clay-muted">{t("finalStory", lang)}</span>
                  <Provenance kind={textProvenance("description", edited, sample)} lang={lang} />
                </div>
                <p className="text-clay-700 mt-1.5 leading-relaxed text-[15px]">{desc}</p>
              </div>

              <dl className="mt-4">
                {DETAIL_FIELDS.map((f) =>
                  listing[f.key] ? (
                    <div key={f.key} className="flex justify-between gap-4 py-2 border-b border-clay-100 last:border-0">
                      <dt className="text-clay-muted text-sm">{t(f.label, lang)}</dt>
                      <dd className="text-clay-900 text-sm font-medium text-right">
                        {listing[f.key]}
                        {edited.includes(f.key) && <span className="ml-1.5 align-middle"><Provenance kind="yours" lang={lang} /></span>}
                      </dd>
                    </div>
                  ) : null,
                )}
              </dl>

              {listing.tags?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {listing.tags.map((tag) => (
                    <span key={tag} className="chip !text-xs">#{tag}</span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {!editing && (
        <button className="btn-primary mt-6" onClick={onDone}>
          {t("next", lang)} →
        </button>
      )}
    </div>
  );
}
