// Publishes that couldn't reach the server, kept on the device and sent when
// the connection is back — the "offline queue" half of offline-first.
//
// Each entry is the exact publish payload (photo included) plus what the UI
// needs to show it. Entries are removed only after the server confirms, so a
// crash mid-send loses nothing; the server may then see a retried publish,
// which is safe because every publish mints its own listing id.

import { idbGet, idbSet } from "./idb";
import { publish } from "./api";
import { resolveQueuedListing } from "./pendingModels";

const KEY = "publishQueue";
const listeners = new Set();

export async function getQueue() {
  return (await idbGet(KEY)) || [];
}

async function save(q) {
  await idbSet(KEY, q);
  listeners.forEach((fn) => fn(q));
}

export function onQueueChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Returns the entry id, so a 3D model still owed to it can follow it live. */
export async function queuePublish(payload, meta) {
  const q = await getQueue();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  q.push({ id, payload, meta, queuedAt: Date.now(), status: "waiting" });
  await save(q);
  return id;
}

let flushing = false;

/** Try to send everything waiting. Resolves to [{entry, result}] of what went through. */
export async function flushQueue() {
  if (flushing) return [];
  flushing = true;
  const sent = [];
  try {
    const q = await getQueue();
    const keep = [];
    for (const entry of q) {
      if (entry.status === "sent") continue;
      try {
        const result = await publish(entry.payload);
        sent.push({ entry, result });
        await resolveQueuedListing(entry.id, result.listing_id);
      } catch (e) {
        // Rejected outright (4xx) → drop with a visible note; else keep waiting.
        keep.push(e.network ? entry : { ...entry, status: "rejected", error: e.message });
      }
    }
    await save(keep);
  } finally {
    flushing = false;
  }
  return sent;
}

export async function dropEntry(id) {
  await save((await getQueue()).filter((e) => e.id !== id));
}
