import React, { useEffect, useState } from "react";
import { t } from "../lib/i18n";
import { listListings, deleteListing, openExternal } from "../lib/api";
import { Spinner, ConfirmSheet } from "./ui";
import ProductImage from "./ProductImage";
import { categoryFor } from "../lib/productImage";

// The artisan's catalogue. This is the screen that answers "is this a product
// or a one-shot demo script?" — publish something, come back here, it's still
// there, because the backend persisted it.

function ProductCard({ row, lang, onDelete }) {
  const title = row.title?.[lang] || row.title?.en || "";
  const disabled = row._demo;
  const cat = categoryFor(row);

  const card = (
    <div className="card overflow-hidden active:scale-[0.98] transition">
      <div className="relative aspect-square bg-clay-100 overflow-hidden">
        <ProductImage row={row} className="w-full h-full object-cover" />
        {/* legibility scrim + category chip, like the reference mockup */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/50 to-transparent" />
        <span className="absolute left-2 bottom-2 rounded-md bg-black/25 px-1.5 py-0.5 text-[10px] font-bold text-white tracking-wide backdrop-blur-[1px]">
          {cat.label}
        </span>
      </div>
      <div className="p-3">
        <p className="text-sm font-semibold text-clay-900 leading-snug line-clamp-2">{title}</p>
        <div className="flex items-center justify-between mt-2">
          <span className="text-sm font-extrabold text-clay-700">
            ₹{Number(row.price).toLocaleString("en-IN")}
          </span>
          <span className="chip !bg-leaf/15 !text-leaf !py-0.5 text-[10px]">● {t("live", lang)}</span>
        </div>
        {row.gi_verified ? (
          <span className="inline-flex items-center gap-1 mt-2 rounded-full bg-leaf/15 px-2 py-0.5 text-[10px] font-bold text-leaf">
            ✓ {t("verifiedGi", lang)}
            {row.gi_state && <span className="font-normal opacity-80">· {row.gi_state}</span>}
          </span>
        ) : (
          row.gi_candidate && <span className="chip mt-2 !py-0.5 text-[10px]">🏷️ {row.gi_candidate}</span>
        )}
      </div>
    </div>
  );

  // The delete button cannot live inside the card's own <button> — nested
  // buttons are invalid and the inner one's clicks get swallowed. Both are
  // children of a positioned wrapper instead.
  const deleteButton = onDelete && (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onDelete(row);
      }}
      aria-label={t("delete", lang)}
      className="absolute right-2 top-2 z-10 h-9 w-9 rounded-full bg-black/45 text-white text-sm backdrop-blur-[2px] flex items-center justify-center active:scale-90 transition"
    >
      🗑️
    </button>
  );

  // In offline demo mode nothing was persisted, so the storefront link would
  // 404. Show the card, just don't promise a page behind it.
  if (disabled) return <div className="relative">{card}</div>;

  // Not an <a target="_blank">: Capacitor's WebView has multiple-window
  // support off, so on a device that tap does nothing at all.
  return (
    <div className="relative">
      <button
        onClick={() => openExternal(row.storefront_url)}
        className="block w-full text-left active:scale-[0.98] transition"
      >
        {card}
      </button>
      {deleteButton}
    </div>
  );
}

export default function MyProducts({ lang, account, onBack, onSellNew }) {
  const [rows, setRows] = useState(null);
  const [pending, setPending] = useState(null); // row awaiting delete confirmation
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const uid = account?.uid || "";

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await listListings(24, uid);
        if (alive) setRows(Array.isArray(data) ? data : []);
      } catch {
        if (alive) setRows([]); // listListings already falls back; belt-and-braces
      }
    })();
    return () => {
      alive = false;
    };
  }, [uid]);

  async function confirmDelete() {
    const row = pending;
    if (!row) return;
    setBusy(true);
    setError("");
    try {
      await deleteListing(row.listing_id, uid);
      // Only drop it from the grid once the server has actually deleted it.
      // Removing optimistically would show a product as gone that is still
      // live on ONDC — the one outcome worse than a slow delete.
      setRows((rs) => rs.filter((r) => r.listing_id !== row.listing_id));
      setPending(null);
    } catch (e) {
      setError(e?.status === 401 || e?.status === 403 ? t("deleteSignIn", lang) : t("deleteFailed", lang));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col min-h-full px-5 pt-4 pb-8 safe-top safe-bottom fade-in">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-clay-700 text-sm font-medium">
          ← {t("back", lang)}
        </button>
        <span className="text-xs font-semibold tracking-wide text-clay-500">
          {rows ? rows.length : ""}
        </span>
      </div>

      <div className="mt-4">
        <h2 className="text-2xl font-extrabold text-clay-900">{t("myProducts", lang)}</h2>
        <p className="text-clay-600 mt-1 text-sm">{t("myProductsSub", lang)}</p>
      </div>

      {rows === null ? (
        <div className="flex-1 flex items-center justify-center">
          <Spinner label={t("loadingProducts", lang)} />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <div className="text-5xl opacity-40">🧺</div>
          <p className="font-bold text-clay-900 mt-4">{t("noProducts", lang)}</p>
          <p className="text-clay-600 text-sm mt-2">{t("noProductsSub", lang)}</p>
          <button className="btn-primary mt-6" onClick={onSellNew}>
            {t("start", lang)} →
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mt-5">
            {rows.map((row) => (
              <ProductCard
                key={row.listing_id}
                row={row}
                lang={lang}
                onDelete={uid && !row._demo ? setPending : undefined}
              />
            ))}
          </div>
          <button className="btn-ghost mt-6" onClick={onSellNew}>
            + {t("sellAnother", lang)}
          </button>
        </>
      )}

      {error && (
        <p className="text-center text-sm text-red-600 mt-4" role="alert">
          {error}
        </p>
      )}

      {pending && (
        <ConfirmSheet
          title={t("deleteProduct", lang)}
          body={busy ? "…" : t("deleteProductBody", lang)}
          confirmLabel={t("delete", lang)}
          cancelLabel={t("cancel", lang)}
          onConfirm={busy ? () => {} : confirmDelete}
          onCancel={busy ? () => {} : () => setPending(null)}
        />
      )}
    </div>
  );
}
