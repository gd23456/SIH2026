"""Self-hosted reconstruction: the Karigar 3D worker (model3d_server/).

Runs Tencent Hunyuan3D-2mv on any machine with a GPU — including an Apple
Silicon Mac — and colours the mesh from the six capture photos. Free to run:
no per-model API cost, and product photos never leave your own machines.

The worker's API (see model3d_server/server.py):
  POST {base}/jobs                six views        -> {"id"}
  GET  {base}/jobs/{id}           -> {"status", "progress", "error"}
  GET  {base}/jobs/{id}/model.glb
"""
from __future__ import annotations

import httpx

from .base import ProviderError, ProviderStatus, validate_glb

_STATE = {"queued": "pending", "processing": "processing", "succeeded": "succeeded", "failed": "failed"}


class LocalProvider:
    name = "local"

    def __init__(self, base_url: str, *, token: str = "", transport: httpx.BaseTransport | None = None):
        self._base = base_url.rstrip("/")
        self._headers = {"Authorization": f"Bearer {token}"} if token else {}
        self.model_version = "hunyuan3d-2mv-turbo+photo-colour-1"
        self._client = httpx.Client(timeout=httpx.Timeout(60.0, connect=5.0), transport=transport)

    def _get(self, path: str) -> httpx.Response:
        try:
            return self._client.get(f"{self._base}{path}", headers=self._headers)
        except httpx.HTTPError as e:
            # Worker down or restarting: try again on the next tick.
            raise ProviderError(f"worker unreachable: {e.__class__.__name__}", retryable=True) from e

    def submit(self, views: dict[str, bytes]) -> str:
        files = {a: (f"{a}.jpg", data, "image/jpeg") for a, data in views.items()}
        try:
            r = self._client.post(f"{self._base}/jobs", files=files, headers=self._headers)
        except httpx.HTTPError as e:
            raise ProviderError(f"worker unreachable: {e.__class__.__name__}", retryable=True) from e
        if r.status_code >= 400:
            raise ProviderError(f"worker refused job: HTTP {r.status_code}", retryable=r.status_code >= 500)
        self.model_version = r.json().get("model_version") or self.model_version
        return r.json()["id"]

    def poll(self, task_id: str) -> ProviderStatus:
        r = self._get(f"/jobs/{task_id}")
        if r.status_code == 404:
            # The worker restarted and lost the job (it keeps jobs in memory).
            raise ProviderError("the 3D worker restarted during this job", retryable=False)
        if r.status_code >= 400:
            raise ProviderError(f"poll: HTTP {r.status_code}", retryable=r.status_code >= 500)
        d = r.json()
        state = _STATE.get(d.get("status"), "processing")
        return ProviderStatus(
            state=state,
            progress=int(d.get("progress") or 0),
            error=d.get("error") or "",
            glb_url=f"{self._base}/jobs/{task_id}/model.glb" if state == "succeeded" else "",
        )

    def fetch_glb(self, status: ProviderStatus) -> bytes:
        path = status.glb_url[len(self._base):]
        r = self._get(path)
        if r.status_code >= 400:
            raise ProviderError(f"download: HTTP {r.status_code}", retryable=r.status_code >= 500)
        return validate_glb(r.content)
