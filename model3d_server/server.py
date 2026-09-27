"""Karigar 3D worker — runs Hunyuan3D-2mv on this Mac and serves a tiny job API.

The Karigar backend talks to it through services/model3d/local.py:

  POST /jobs              six views (multipart: front,right,back,left,top,bottom) -> {"id"}
  GET  /jobs/{id}         -> {"status": queued|processing|succeeded|failed, "stage", "progress", "error"}
  GET  /jobs/{id}/model.glb
  GET  /health            -> device, whether the model is loaded, model version

One job at a time (one GPU). Jobs live in memory; results on disk under
./out. If this process restarts, unfinished jobs are gone — the backend sees
a 404, marks the job failed, and the artisan can tap "Try again".

Run:  .venv/bin/uvicorn server:app --host 127.0.0.1 --port 8100
Auth: set MODEL3D_LOCAL_TOKEN (same value in the backend's .env) — every
      request must carry it as a Bearer token.
"""
from __future__ import annotations

import hmac
import logging
import os
import queue
import threading
import time
import uuid
from pathlib import Path

from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.responses import FileResponse

import reconstruct

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("model3d.server")

OUT = Path(__file__).parent / "out"
OUT.mkdir(exist_ok=True)
TOKEN = os.environ.get("MODEL3D_LOCAL_TOKEN", "")
MAX_BYTES = 12 * 1024 * 1024
KEEP_SECONDS = 24 * 3600  # results are fetched by the backend within seconds

app = FastAPI(title="Karigar 3D worker")
jobs: dict[str, dict] = {}
work: "queue.Queue[str]" = queue.Queue()


def auth(authorization: str | None = Header(default=None)):
    if TOKEN and not hmac.compare_digest(authorization or "", f"Bearer {TOKEN}"):
        raise HTTPException(401, "bad token")


def _worker():
    while True:
        job_id = work.get()
        job = jobs.get(job_id)
        if job is None:
            continue
        job["status"] = "processing"

        def progress(stage, pct):
            job["stage"], job["progress"] = stage, pct

        try:
            glb = reconstruct.reconstruct(job.pop("views"), progress=progress)
            (OUT / f"{job_id}.glb").write_bytes(glb)
            job.update(status="succeeded", progress=100, stage="done")
        except Exception as e:  # report, never crash the worker
            log.exception("job %s failed", job_id)
            job.update(status="failed", error=f"{e.__class__.__name__}: {e}"[:300])
        finally:
            job["finished"] = time.time()
            _prune()


def _prune():
    cutoff = time.time() - KEEP_SECONDS
    for jid, j in list(jobs.items()):
        if j.get("finished", time.time()) < cutoff:
            (OUT / f"{jid}.glb").unlink(missing_ok=True)
            jobs.pop(jid, None)


threading.Thread(target=_worker, daemon=True).start()
# Warm the model in the background so the first artisan doesn't wait for it.
threading.Thread(target=reconstruct.load, daemon=True).start()


@app.get("/health")
def health():
    import torch

    return {
        "ok": True,
        "device": "mps" if torch.backends.mps.is_available() else ("cuda" if torch.cuda.is_available() else "cpu"),
        "loaded": reconstruct._pipeline is not None,
        "model_version": reconstruct.MODEL_VERSION,
        "queued": work.qsize(),
    }


@app.post("/jobs", dependencies=[Depends(auth)])
async def create(
    front: UploadFile = File(...), right: UploadFile = File(...), back: UploadFile = File(...),
    left: UploadFile = File(...), top: UploadFile = File(...), bottom: UploadFile = File(...),
):
    views = {}
    for name, f in {"front": front, "right": right, "back": back, "left": left, "top": top, "bottom": bottom}.items():
        data = await f.read(MAX_BYTES + 1)
        if not data or len(data) > MAX_BYTES:
            raise HTTPException(400, f"{name}: missing or too large")
        views[name] = data
    job_id = uuid.uuid4().hex
    jobs[job_id] = {"status": "queued", "stage": "queued", "progress": 0, "error": "", "views": views}
    work.put(job_id)
    return {"id": job_id, "model_version": reconstruct.MODEL_VERSION}


@app.get("/jobs/{job_id}", dependencies=[Depends(auth)])
def status(job_id: str):
    job = jobs.get(job_id)
    if job is None:
        raise HTTPException(404, "no such job")
    return {k: job[k] for k in ("status", "stage", "progress", "error")}


@app.get("/jobs/{job_id}/model.glb", dependencies=[Depends(auth)])
def model(job_id: str):
    path = OUT / f"{job_id}.glb"
    if not job_id.isalnum() or not path.exists():
        raise HTTPException(404, "no model")
    return FileResponse(path, media_type="model/gltf-binary")
