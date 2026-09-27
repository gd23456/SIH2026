// Tiny IndexedDB key-value store for things that must survive the app being
// closed: the unfinished product (with its six photos as Blobs) and the queue
// of work waiting for a connection.
//
// IndexedDB, not localStorage: photos are binary and several MB; localStorage
// is string-only and capped around 5 MB. In the Capacitor APK this is the
// WebView's own app-private storage.
//
// Every call resolves (never throws) so a storage failure — private window,
// quota — degrades to "not saved" instead of breaking the flow.

const DB_NAME = "karigar";
const DB_VERSION = 1;
const STORE = "kv";

let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function tx(mode, fn) {
  return open().then(
    (db) =>
      new Promise((resolve) => {
        if (!db) return resolve(undefined);
        try {
          const t = db.transaction(STORE, mode);
          const store = t.objectStore(STORE);
          const req = fn(store);
          t.oncomplete = () => resolve(req?.result);
          t.onerror = () => resolve(undefined);
          t.onabort = () => resolve(undefined);
        } catch {
          resolve(undefined);
        }
      }),
  );
}

export const idbGet = (key) => tx("readonly", (s) => s.get(key));
export const idbSet = (key, value) => tx("readwrite", (s) => s.put(value, key)).then(() => true);
export const idbDel = (key) => tx("readwrite", (s) => s.delete(key)).then(() => true);

/** Ask the browser not to evict our storage under pressure (best effort). */
export async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch {}
}
