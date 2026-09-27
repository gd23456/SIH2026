// 3D models still owed to products that are already live.
//
// A product captured offline can be published (via the publish queue) before
// its six photos ever reach the server. Its 3D isn't abandoned: the photos stay
// on the device, and this finishes the job whenever there is a connection —
// upload, wait for the model, then link it to the live listing. It survives
// app restarts: the list lives in IndexedDB.
//
// Entry: {id, clientId, model, listingId | null, queueId | null}
//   queueId is set while the listing itself is still in the publish queue;
//   the queue swaps it for the real listingId once the publish goes through.

import { apiBase } from "./api";
import { idbGet, idbSet } from "./idb";
import { ModelSync, dropCaptures } from "./model3d";

const KEY = "pendingModels";
const running = new Map();

const getAll = async () => (await idbGet(KEY)) || [];
const saveAll = (list) => idbSet(KEY, list);

async function update(id, patch) {
  const list = await getAll();
  await saveAll(list.map((p) => (p.id === id ? { ...p, ...patch } : p)));
}

export async function addPendingModel(entry) {
  const list = await getAll();
  list.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ...entry });
  await saveAll(list);
}

/** Called by the publish queue when a queued publish finally goes live. */
export async function resolveQueuedListing(queueId, listingId) {
  const list = await getAll();
  if (!list.some((p) => p.queueId === queueId)) return;
  await saveAll(list.map((p) => (p.queueId === queueId ? { ...p, queueId: null, listingId } : p)));
}

async function attach(listingId, jobId, token, uid) {
  const fd = new FormData();
  fd.append("job_id", jobId);
  fd.append("uid", uid || "");
  const res = await fetch(`${apiBase()}/api/listings/${encodeURIComponent(listingId)}/model`, {
    method: "POST",
    headers: { "X-Model-Token": token },
    body: fd,
  });
  if (!res.ok) {
    const e = new Error(`HTTP ${res.status}`);
    e.status = res.status;
    throw e;
  }
}

/** Push every owed model forward. Safe to call repeatedly (app start, "online"). */
export async function processPendingModels(uid) {
  for (const p of await getAll()) {
    if (!p.listingId || running.has(p.id)) continue;
    let attaching = false;
    const sync = new ModelSync({
      uid,
      onChange: async (st) => {
        await update(p.id, { model: st });
        if (!st.jobId || !st.token || attaching) return;
        attaching = true;
        try {
          await attach(p.listingId, st.jobId, st.token, uid);
          // Linked: the server has the photos and the job; the storefront
          // shows the model whenever it finishes. Nothing left to do here.
          sync.stop();
          running.delete(p.id);
          await saveAll((await getAll()).filter((x) => x.id !== p.id));
          dropCaptures(p.clientId);
        } catch (e) {
          attaching = false;
          if (e.status === 404) {
            // Listing deleted (or not theirs): nothing to attach to any more.
            sync.stop();
            running.delete(p.id);
            await saveAll((await getAll()).filter((x) => x.id !== p.id));
          }
        }
      },
    });
    running.set(p.id, sync);
    sync.start(p.model);
  }
}
