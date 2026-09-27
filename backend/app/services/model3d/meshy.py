"""Meshy multi-image-to-3D — the production reconstruction provider.

API: https://docs.meshy.ai/en/api/multi-image-to-3d
  POST {base}/multi-image-to-3d          {"image_urls": [...]}  -> {"result": task_id}
  GET  {base}/multi-image-to-3d/{task}   -> {status, progress, model_urls.glb, task_error}

Why Meshy: six photos from fixed angles are far too few for classic
photogrammetry (which wants dozens of overlapping shots), so a multi-view
generative reconstructor is the approach that actually works from what an
artisan can capture on a phone. Meshy accepts the views as base64 data URIs,
so product photos never have to sit in a public bucket for it to fetch.

Meshy takes at most FOUR views. We send the four around the product (front,
right, back, left) — the silhouette-defining ones. Top and bottom are still
captured, validated and stored: they are shown to buyers as photos, and a
provider that accepts more views gets them via the same interface.
"""
from __future__ import annotations

import base64
import logging

import httpx

from .base import ProviderError, ProviderStatus, validate_glb

log = logging.getLogger("karigar.model3d.meshy")

SEND_ORDER = ("front", "right", "back", "left")
MAX_VIEWS = 4

_STATE = {
    "PENDING": "pending",
    "IN_PROGRESS": "processing",
    "SUCCEEDED": "succeeded",
    "FAILED": "failed",
    "CANCELED": "failed",
    "EXPIRED": "failed",
}


class MeshyProvider:
    name = "meshy"

    def __init__(self, api_key: str, *, base_url: str, ai_model: str = "latest",
                 transport: httpx.BaseTransport | None = None):
        if not api_key.strip():
            raise ValueError("MESHY_API_KEY is not set")
        self._key = api_key.strip()
        self._base = base_url.rstrip("/")
        self._ai_model = ai_model or "latest"
        self.model_version = f"meshy:{self._ai_model}"
        # transport is injectable so tests exercise the real request/response
        # handling without touching the network.
        self._client = httpx.Client(timeout=httpx.Timeout(60.0, connect=15.0), transport=transport)

    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self._key}"}

    @staticmethod
    def _raise_for(r: httpx.Response, action: str) -> None:
        if r.status_code < 400:
            return
        try:
            msg = r.json().get("message") or r.text
        except ValueError:
            msg = r.text
        retryable = r.status_code == 429 or r.status_code >= 500
        # 401/402/403 are configuration/billing problems: loud in the logs,
        # a plain "couldn't create" for the artisan.
        log.warning("meshy %s failed: HTTP %s %s", action, r.status_code, msg[:200])
        raise ProviderError(f"{action}: HTTP {r.status_code} {msg[:200]}", retryable=retryable)

    def submit(self, views: dict[str, bytes]) -> str:
        chosen = [a for a in SEND_ORDER if a in views][:MAX_VIEWS]
        if len(chosen) < 2:
            raise ProviderError("need at least two side views")
        image_urls = [
            "data:image/jpeg;base64," + base64.b64encode(views[a]).decode("ascii") for a in chosen
        ]
        body = {
            "image_urls": image_urls,
            "ai_model": self._ai_model,
            "should_texture": True,
            "enable_pbr": False,
            "should_remesh": True,
            "topology": "triangle",
            # Enough detail for a craft object, small enough for a phone on 4G.
            "target_polycount": 30000,
            "target_formats": ["glb"],
            "image_enhancement": True,
            "remove_lighting": True,
            "moderation": True,
        }
        try:
            r = self._client.post(f"{self._base}/multi-image-to-3d", json=body, headers=self._headers())
        except httpx.HTTPError as e:
            raise ProviderError(f"submit: {e.__class__.__name__}", retryable=True) from e
        self._raise_for(r, "submit")
        task_id = (r.json() or {}).get("result")
        if not task_id:
            raise ProviderError("submit: no task id in response")
        return str(task_id)

    def poll(self, task_id: str) -> ProviderStatus:
        try:
            r = self._client.get(f"{self._base}/multi-image-to-3d/{task_id}", headers=self._headers())
        except httpx.HTTPError as e:
            raise ProviderError(f"poll: {e.__class__.__name__}", retryable=True) from e
        self._raise_for(r, "poll")
        data = r.json() or {}
        state = _STATE.get(str(data.get("status", "")).upper(), "processing")
        err = ((data.get("task_error") or {}).get("message") or "") if state == "failed" else ""
        return ProviderStatus(
            state=state,
            progress=int(data.get("progress") or 0),
            error=err,
            glb_url=((data.get("model_urls") or {}).get("glb") or ""),
            extra={"thumbnail_url": data.get("thumbnail_url") or ""},
        )

    def fetch_glb(self, status: ProviderStatus) -> bytes:
        if not status.glb_url:
            raise ProviderError("finished task has no GLB url")
        try:
            # Signed asset URL — no auth header, and never forward our key to it.
            r = self._client.get(status.glb_url, follow_redirects=True, timeout=120.0)
        except httpx.HTTPError as e:
            raise ProviderError(f"download: {e.__class__.__name__}", retryable=True) from e
        self._raise_for(r, "download")
        return validate_glb(r.content)
