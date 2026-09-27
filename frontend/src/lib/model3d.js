// 3D product: upload the six capture views, then follow the server job until
// there is a model — across bad connections and app restarts.
//
//   captured ─► (offline? wait) ─► uploading ─► queued ─► processing ─► ready
//                                        │                     └──────► failed ─► retry
//                                        └─ network error ─► waiting (auto-retry)
//
// All state is plain data (no Blobs) so the draft autosave can persist it;
// the photos themselves live in IndexedDB under `captures:<clientId>` until the
// server has confirmed the upload.

import { apiBase } from "./api";
import { idbDel, idbGet, idbSet } from "./idb";

export const ANGLES = ["front", "right", "back", "left", "top", "bottom"];

const capturesKey = (clientId) => `captures:${clientId}`;

export function newClientId() {
  try {
    return crypto.randomUUID().replace(/-/g, "");
  } catch {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
}

export const saveCaptures = (clientId, blobs) => idbSet(capturesKey(clientId), blobs);
export const loadCaptures = (clientId) => idbGet(capturesKey(clientId));
export const dropCaptures = (clientId) => idbDel(capturesKey(clientId));

/** A fresh 3D state for six just-captured photos. */
export function initialModelState(clientId) {
  return { clientId, phase: "saved", jobId: null, token: null, uploadPct: 0, progress: 0,
    modelUrl: null, isTest: false, error: "", attempts: 0 };
}

// ---------------------------------------------------------------- API ---

function upload(blobs, { uid, clientId }, onProgress) {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    for (const a of ANGLES) fd.append(a, blobs[a], `${a}.jpg`);
    fd.append("uid", uid || "");
    fd.append("client_id", clientId);
    // XHR, not fetch: fetch can't report upload progress, and on a slow
    // connection six photos is the part the artisan waits on.
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${apiBase()}/api/models`);
    xhr.timeout = 180000;
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      let body = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300 && body) resolve(body);
      else {
        const err = new Error(body?.detail || `HTTP ${xhr.status}`);
        err.status = xhr.status;
        reject(err);
      }
    };
    const net = () => {
      const err = new Error("network");
      err.network = true;
      reject(err);
    };
    xhr.onerror = net;
    xhr.ontimeout = net;
    xhr.send(fd);
  });
}

async function getJob(jobId, token) {
  const res = await fetch(`${apiBase()}/api/models/${jobId}`, { headers: { "X-Model-Token": token } });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function retryJob(jobId, token) {
  const res = await fetch(`${apiBase()}/api/models/${jobId}/retry`, {
    method: "POST",
    headers: { "X-Model-Token": token },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Owner-side URL for one capture view (private until published). */
export function viewUrl(jobId, angle, token) {
  return `${apiBase()}/api/models/${jobId}/views/${angle}.jpg?token=${encodeURIComponent(token)}`;
}

function fromServer(state, job) {
  const phase = { queued: "queued", processing: "processing", ready: "ready", failed: "failed",
    unavailable: "unavailable", expired: "failed" }[job.status] || "processing";
  return {
    ...state,
    phase,
    jobId: job.job_id,
    progress: job.progress || 0,
    modelUrl: job.model_url || null,
    isTest: Boolean(job.is_test_model),
    error: job.error || "",
  };
}

// --------------------------------------------------------- the engine ---

const BACKOFF = [3000, 8000, 20000, 45000, 90000];

/**
 * Drives one product's 3D state forward. `onChange(next)` receives every new
 * state; the owner persists it. Safe to start() again after an app restart
 * with the persisted state — it resumes from wherever that state says.
 */
export class ModelSync {
  constructor({ uid, onChange }) {
    this.uid = uid;
    this.onChange = onChange;
    this.state = null;
    this.timer = null;
    this.stopped = false;
    this.busy = false;
    this.onOnline = () => this.kick(0);
    window.addEventListener("online", this.onOnline);
  }

  set(patch) {
    this.state = { ...this.state, ...patch, updatedAt: Date.now() };
    this.onChange(this.state);
  }

  start(state) {
    this.state = state;
    this.kick(0);
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    window.removeEventListener("online", this.onOnline);
  }

  kick(delay) {
    if (this.stopped) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.tick(), delay);
  }

  later() {
    const n = Math.min(this.state.attempts || 0, BACKOFF.length - 1);
    this.set({ attempts: (this.state.attempts || 0) + 1 });
    this.kick(BACKOFF[n]);
  }

  async tick() {
    if (this.busy || this.stopped || !this.state) return;
    this.busy = true;
    try {
      const s = this.state;
      if (!s.jobId) await this.doUpload();
      else if (["queued", "processing", "uploaded"].includes(s.phase)) await this.doPoll();
    } finally {
      this.busy = false;
    }
  }

  async doUpload() {
    const s = this.state;
    const blobs = await loadCaptures(s.clientId);
    if (!blobs || ANGLES.some((a) => !blobs[a])) {
      this.set({ phase: "failed", error: "photos-missing" });
      return;
    }
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      this.set({ phase: "offline" });
      return; // the "online" event restarts us
    }
    this.set({ phase: "uploading", uploadPct: 0, error: "" });
    try {
      const job = await upload(blobs, { uid: this.uid, clientId: s.clientId }, (p) =>
        this.set({ uploadPct: p }),
      );
      // The token is shown once; a retried upload of the same clientId gets
      // the same job back WITHOUT it — keep the one we already have.
      const token = job.token || s.token;
      this.set({ ...fromServer(this.state, job), token, uploadPct: 1, attempts: 0 });
      // Server holds the photos now; free the device copy only once the job
      // can no longer need a re-upload.
      this.kick(1500);
    } catch (e) {
      if (e.network || !e.status || e.status >= 500) {
        this.set({ phase: "offline", error: "" });
        this.later();
      } else {
        // 4xx: the server rejected the photos. Retrying the same bytes won't help.
        this.set({ phase: "failed", error: e.message || "rejected" });
      }
    }
  }

  async doPoll() {
    const s = this.state;
    try {
      const job = await getJob(s.jobId, s.token);
      this.set({ ...fromServer(this.state, job), attempts: 0 });
      if (job.status === "ready") dropCaptures(s.clientId);
      if (["queued", "processing"].includes(job.status)) {
        this.kick(job.status === "queued" ? 3000 : 5000);
      }
    } catch (e) {
      if (e.status === 404) this.set({ phase: "failed", error: "job-missing" });
      else this.later(); // network hiccup: keep the phase, try again
    }
  }

  async retry() {
    const s = this.state;
    if (!s) return;
    if (!s.jobId) {
      this.set({ attempts: 0 });
      return this.kick(0);
    }
    try {
      const job = await retryJob(s.jobId, s.token);
      this.set({ ...fromServer(this.state, job), attempts: 0 });
      this.kick(2000);
    } catch {
      this.later();
    }
  }
}
