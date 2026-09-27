"""Development-only reconstruction provider.

NOT a reconstruction. It writes a genuine binary glTF — a box whose six faces
are the six captured views — so the upload → job → GLB → viewer pipeline can
be run end to end on a laptop with no provider account. The model is labelled
`dev-box` everywhere it surfaces, the app shows it as a "test model", and
`get_provider()` refuses this provider when APP_ENV=production.
"""
from __future__ import annotations

import io
import json
import struct
import uuid

from PIL import Image

from .base import ProviderError, ProviderStatus

# Face corners listed bottom-left, bottom-right, top-right, top-left as seen by
# someone looking AT that face from outside — so indices (0,1,2),(0,2,3) wind
# counter-clockwise, which glTF treats as front-facing. +Y up, +Z = front.
_FACES = {
    "front": ((-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1), (0, 0, 1)),
    "back": ((1, -1, -1), (-1, -1, -1), (-1, 1, -1), (1, 1, -1), (0, 0, -1)),
    "right": ((1, -1, 1), (1, -1, -1), (1, 1, -1), (1, 1, 1), (1, 0, 0)),
    "left": ((-1, -1, -1), (-1, -1, 1), (-1, 1, 1), (-1, 1, -1), (-1, 0, 0)),
    "top": ((-1, 1, 1), (1, 1, 1), (1, 1, -1), (-1, 1, -1), (0, 1, 0)),
    "bottom": ((-1, -1, -1), (1, -1, -1), (1, -1, 1), (-1, -1, 1), (0, -1, 0)),
}
_UV = (0.0, 1.0, 1.0, 1.0, 1.0, 0.0, 0.0, 0.0)  # image top is v=0 in glTF


def _pad(b: bytes, fill: bytes = b"\x00") -> bytes:
    return b + fill * ((4 - len(b) % 4) % 4)


def _texture(jpeg: bytes) -> bytes:
    # Keep the test asset small: 512px faces are plenty to see what's what.
    im = Image.open(io.BytesIO(jpeg)).convert("RGB")
    im.thumbnail((512, 512))
    out = io.BytesIO()
    im.save(out, format="JPEG", quality=82)
    return out.getvalue()


def build_box_glb(views: dict[str, bytes]) -> bytes:
    front = Image.open(io.BytesIO(views["front"]))
    side = Image.open(io.BytesIO(views.get("right") or views["front"]))
    # Proportions from the photos: height from the front view's aspect, depth
    # from the side view's — so a tall vase is a tall box, not a cube.
    hx = 0.5
    hy = max(0.2, min(1.5, 0.5 * front.height / max(1, front.width)))
    hz = max(0.15, min(1.5, hy * side.width / max(1, side.height)))

    binary = bytearray()
    buffer_views, accessors, images, textures, materials, primitives = [], [], [], [], [], []

    def add_view(data: bytes, target: int | None = None) -> int:
        offset = len(binary)
        binary.extend(_pad(data))
        bv = {"buffer": 0, "byteOffset": offset, "byteLength": len(data)}
        if target:
            bv["target"] = target
        buffer_views.append(bv)
        return len(buffer_views) - 1

    for angle, (*corners, normal) in _FACES.items():
        if angle not in views:
            continue
        pos = [(c[0] * hx, c[1] * hy, c[2] * hz) for c in corners]
        pos_b = b"".join(struct.pack("<3f", *p) for p in pos)
        nrm_b = struct.pack("<3f", *normal) * 4
        uv_b = struct.pack("<8f", *_UV)
        idx_b = struct.pack("<6H", 0, 1, 2, 0, 2, 3)

        a_pos = len(accessors)
        accessors.append({
            "bufferView": add_view(pos_b, 34962), "componentType": 5126, "count": 4, "type": "VEC3",
            "min": [min(p[i] for p in pos) for i in range(3)],
            "max": [max(p[i] for p in pos) for i in range(3)],
        })
        accessors.append({"bufferView": add_view(nrm_b, 34962), "componentType": 5126, "count": 4, "type": "VEC3"})
        accessors.append({"bufferView": add_view(uv_b, 34962), "componentType": 5126, "count": 4, "type": "VEC2"})
        accessors.append({"bufferView": add_view(idx_b, 34963), "componentType": 5123, "count": 6, "type": "SCALAR"})

        images.append({"bufferView": add_view(_texture(views[angle])), "mimeType": "image/jpeg"})
        textures.append({"source": len(images) - 1, "sampler": 0})
        materials.append({
            "name": angle,
            "pbrMetallicRoughness": {
                "baseColorTexture": {"index": len(textures) - 1},
                "metallicFactor": 0.0,
                "roughnessFactor": 0.85,
            },
        })
        primitives.append({
            "attributes": {"POSITION": a_pos, "NORMAL": a_pos + 1, "TEXCOORD_0": a_pos + 2},
            "indices": a_pos + 3,
            "material": len(materials) - 1,
        })

    gltf = {
        "asset": {"version": "2.0", "generator": "karigar-dev-box"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": "product"}],
        "meshes": [{"primitives": primitives}],
        "materials": materials,
        "textures": textures,
        "images": images,
        "samplers": [{"magFilter": 9729, "minFilter": 9987}],
        "accessors": accessors,
        "bufferViews": buffer_views,
        "buffers": [{"byteLength": len(binary)}],
    }
    json_chunk = _pad(json.dumps(gltf, separators=(",", ":")).encode(), b" ")
    bin_chunk = bytes(binary)
    total = 12 + 8 + len(json_chunk) + 8 + len(bin_chunk)
    return b"".join([
        struct.pack("<4sII", b"glTF", 2, total),
        struct.pack("<I4s", len(json_chunk), b"JSON"), json_chunk,
        struct.pack("<I4s", len(bin_chunk), b"BIN\x00"), bin_chunk,
    ])


class MockProvider:
    """Finishes on the second poll, so the "building" state is visible in the UI."""

    name = "mock"
    model_version = "dev-box-1"

    def __init__(self, *, fail: bool = False):
        self._fail = fail
        self._tasks: dict[str, dict] = {}

    def submit(self, views: dict[str, bytes]) -> str:
        if "front" not in views:
            raise ProviderError("front view missing")
        task = uuid.uuid4().hex
        self._tasks[task] = {"views": views, "polls": 0}
        return task

    def poll(self, task_id: str) -> ProviderStatus:
        t = self._tasks.get(task_id)
        if t is None:
            # Process restarted: the in-memory task is gone. Report it failed
            # so the job can be retried, exactly as a real provider expiry.
            return ProviderStatus(state="failed", error="dev task lost on restart")
        t["polls"] += 1
        if self._fail:
            return ProviderStatus(state="failed", error="simulated provider failure")
        if t["polls"] < 2:
            return ProviderStatus(state="processing", progress=50)
        return ProviderStatus(state="succeeded", progress=100, glb_bytes=build_box_glb(t["views"]))

    def fetch_glb(self, status: ProviderStatus) -> bytes:
        if not status.glb_bytes:
            raise ProviderError("no model")
        return status.glb_bytes
