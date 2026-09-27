"""The contract every 3D reconstruction provider implements.

The rest of the app — upload route, worker, storefront — only ever talks to
this interface, so swapping Meshy for another hosted API or a self-hosted
model (Hunyuan3D-2mv, a photogrammetry box, …) is one new adapter plus one
config value. Nothing else changes.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

# The six views the capture UI collects, in capture order.
ANGLES: tuple[str, ...] = ("front", "right", "back", "left", "top", "bottom")


class ProviderError(Exception):
    """A failure the provider reported (bad input, moderation, its own error).

    `retryable` separates "try again later" (rate limit, 5xx, network) from
    "this input will never work" — the worker only retries the former.
    """

    def __init__(self, message: str, *, retryable: bool = False):
        super().__init__(message)
        self.retryable = retryable


@dataclass
class ProviderStatus:
    # pending | processing | succeeded | failed
    state: str
    progress: int = 0
    error: str = ""
    # When succeeded: where to fetch the GLB from (provider-hosted, usually a
    # short-lived signed URL) — or the bytes directly for local providers.
    glb_url: str = ""
    glb_bytes: bytes | None = None
    extra: dict = field(default_factory=dict)


class ReconstructionProvider(Protocol):
    name: str
    model_version: str

    def submit(self, views: dict[str, bytes]) -> str:
        """Start a reconstruction from JPEG views keyed by angle. Returns the provider task id."""

    def poll(self, task_id: str) -> ProviderStatus:
        """Current state of a task."""

    def fetch_glb(self, status: ProviderStatus) -> bytes:
        """Download the finished model as binary glTF."""


GLB_MAGIC = b"glTF"
MAX_GLB_BYTES = 80 * 1024 * 1024


def validate_glb(data: bytes) -> bytes:
    """Refuse anything that isn't a plausible binary glTF before we store/serve it."""
    if len(data) < 20 or data[:4] != GLB_MAGIC:
        raise ProviderError("provider returned a file that is not a GLB")
    if len(data) > MAX_GLB_BYTES:
        raise ProviderError("provider returned a model larger than the limit")
    return data
