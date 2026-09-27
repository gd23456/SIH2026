"""Six product photos -> a coloured 3D mesh (GLB), on an Apple Silicon Mac.

Shape:  Tencent Hunyuan3D-2mv (turbo), multi-view conditioned on the
        FRONT / LEFT / BACK / RIGHT photos, running on the Mac GPU (MPS).
Colour: Hunyuan's own texture stage needs ~38 GB and a CUDA rasteriser, so it
        cannot run on a 16 GB Mac. Instead every vertex is coloured from the
        artisan's own six photos — each surface takes its colour from the
        photos that face it. This uses TOP and BOTTOM too, which the shape
        model never sees.

Which way does each photo face the generated mesh? Not assumed: each view's
silhouette is matched against the mesh's silhouette seen from every axis
direction, and the best match wins. That also tolerates an artisan who turned
the product the other way round.

Tencent Hunyuan 3D 2.0 is licensed under the Tencent Hunyuan 3D 2.0 Community
License Agreement, Copyright © 2025 Tencent. All Rights Reserved. The
trademark rights of "Tencent Hunyuan" are owned by Tencent or its affiliate.
(See NOTICE.) Karigar AI is not affiliated with or endorsed by Tencent.
"""
from __future__ import annotations

import io
import logging
import os
import threading
import time

import numpy as np
from PIL import Image

log = logging.getLogger("model3d.reconstruct")

REPO = "tencent/Hunyuan3D-2mv"
SUBFOLDER = "hunyuan3d-dit-v2-mv-turbo"
MODEL_VERSION = f"hunyuan3d-2mv-turbo+photo-colour-1"

# Hunyuan's multi-view keys, from our capture angles.
SHAPE_VIEWS = {"front": "front", "left": "left", "back": "back", "right": "right"}
ANGLES = ("front", "right", "back", "left", "top", "bottom")

_pipeline = None
_rembg = None
_lock = threading.Lock()  # one GPU job at a time


def _device():
    import torch

    if torch.backends.mps.is_available():
        return "mps"
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"


def load():
    """Load the model once (≈5 GB). Later calls are free."""
    global _pipeline, _rembg
    if _pipeline is not None:
        return
    import torch
    from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline
    from rembg import new_session

    dev = _device()
    t = time.time()
    _pipeline = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(
        REPO, subfolder=SUBFOLDER, variant="fp16", use_safetensors=True,
        device=dev, dtype=torch.float16,
    )
    try:
        _pipeline.enable_flashvdm()  # faster volume decoding; optional
    except Exception as e:  # pragma: no cover - backend dependent
        log.info("flashvdm unavailable on %s: %s", dev, e)
    # U²-Net (Apache-2.0, ~170 MB) — the same remover the backend uses.
    # Deliberately NOT hy3dgen's default BackgroundRemover, which pulls
    # BRIA RMBG-2.0: a 1 GB model licensed CC BY-NC (non-commercial only).
    _rembg = new_session("u2net")
    log.info("model loaded on %s in %.1fs", dev, time.time() - t)


# ------------------------------------------------------------ preprocessing ---


def _cutout(jpeg: bytes) -> Image.Image:
    """Background-removed RGBA, cropped to the object with a small margin."""
    im = Image.open(io.BytesIO(jpeg)).convert("RGB")
    im.thumbnail((1024, 1024))
    from rembg import remove

    rgba = remove(im, session=_rembg).convert("RGBA")
    a = np.asarray(rgba)[..., 3]
    ys, xs = np.nonzero(a > 127)
    if len(xs) < 50:  # nothing found: keep the whole frame rather than fail
        return rgba
    pad = int(0.04 * max(im.size))
    box = (max(0, xs.min() - pad), max(0, ys.min() - pad),
           min(im.width, xs.max() + pad), min(im.height, ys.max() + pad))
    return rgba.crop(box)


# ------------------------------------------------------------------- colour ---

# Six axis directions a camera can look FROM (unit vector camera -> object is -d).
_DIRS = {
    "+x": np.array([1, 0, 0.0]), "-x": np.array([-1, 0, 0.0]),
    "+y": np.array([0, 1, 0.0]), "-y": np.array([0, -1, 0.0]),
    "+z": np.array([0, 0, 1.0]), "-z": np.array([0, 0, -1.0]),
}


def _frames(d: np.ndarray):
    """The 8 image-plane orientations (u right, v down) for a camera along d."""
    axes = [np.array(a, float) for a in np.eye(3) if abs(np.dot(a, d)) < 0.5]
    out = []
    for a, b in ((axes[0], axes[1]), (axes[1], axes[0])):
        for su in (1, -1):
            for sv in (1, -1):
                out.append((su * a, sv * b))
    return out


def _mask_grid(alpha: np.ndarray, n: int = 48) -> np.ndarray:
    ys, xs = np.nonzero(alpha > 127)
    if len(xs) == 0:
        return np.zeros((n, n), bool)
    crop = alpha[ys.min(): ys.max() + 1, xs.min(): xs.max() + 1] > 127
    im = Image.fromarray((crop * 255).astype(np.uint8)).resize((n, n), Image.NEAREST)
    return np.asarray(im) > 127


def _points_grid(u: np.ndarray, v: np.ndarray, n: int = 48) -> np.ndarray:
    g = np.zeros((n, n), bool)
    ui = ((u - u.min()) / max(1e-6, np.ptp(u)) * (n - 1)).astype(int)
    vi = ((v - v.min()) / max(1e-6, np.ptp(v)) * (n - 1)).astype(int)
    g[vi, ui] = True
    # close small gaps between sampled points
    from scipy.ndimage import binary_closing, binary_fill_holes

    return binary_fill_holes(binary_closing(g, iterations=2))


def _calibrate(mesh, cutouts: dict[str, Image.Image]):
    """For each photo, find (direction, u axis, v axis) of best silhouette match.

    Aspect ratio matters as much as shape, so the score blends silhouette IoU
    with how well the width:height ratios agree.
    """
    pts = mesh.sample(40000)
    used = set()
    result = {}
    # Side views first (strongest silhouettes), then top/bottom.
    for angle in ("front", "back", "right", "left", "top", "bottom"):
        if angle not in cutouts:
            continue
        alpha = np.asarray(cutouts[angle])[..., 3]
        ys, xs = np.nonzero(alpha > 127)
        if len(xs) == 0:
            continue
        img_ratio = (np.ptp(xs) + 1) / (np.ptp(ys) + 1)
        target = _mask_grid(alpha)
        best = None
        for name, d in _DIRS.items():
            if name in used:
                continue
            for ua, va in _frames(d):
                u, v = pts @ ua, pts @ va
                ratio = max(1e-6, np.ptp(u)) / max(1e-6, np.ptp(v))
                g = _points_grid(u, v)
                iou = (g & target).sum() / max(1, (g | target).sum())
                score = iou - 0.5 * abs(np.log(ratio / img_ratio))
                if best is None or score > best[0]:
                    best = (score, name, d, ua, va)
        if best is None:
            continue
        used.add(best[1])
        result[angle] = {"dir": best[2], "u": best[3], "v": best[4], "score": round(float(best[0]), 3)}
    return result


def _colour(mesh, cutouts: dict[str, Image.Image], calib: dict) -> np.ndarray:
    """Per-vertex RGBA from the photos, weighted by how squarely each faces the surface."""
    verts = np.asarray(mesh.vertices)
    normals = np.asarray(mesh.vertex_normals)
    acc = np.zeros((len(verts), 3))
    wsum = np.zeros(len(verts))
    for angle, c in calib.items():
        rgba = np.asarray(cutouts[angle].convert("RGBA")).astype(float)
        alpha = rgba[..., 3]
        ys, xs = np.nonzero(alpha > 127)
        x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
        u, v = verts @ c["u"], verts @ c["v"]
        # map the mesh's extent onto the object's extent in the photo
        px = x0 + (u - u.min()) / max(1e-6, np.ptp(u)) * (x1 - x0)
        py = y0 + (v - v.min()) / max(1e-6, np.ptp(v)) * (y1 - y0)
        px = np.clip(px.round().astype(int), 0, rgba.shape[1] - 1)
        py = np.clip(py.round().astype(int), 0, rgba.shape[0] - 1)
        facing = np.clip(normals @ c["dir"], 0, None) ** 3
        visible = alpha[py, px] > 127
        w = facing * visible
        acc += rgba[py, px, :3] * w[:, None]
        wsum += w
    colours = np.zeros((len(verts), 4), np.uint8)
    colours[:, 3] = 255
    have = wsum > 1e-6
    fallback = (acc[have].sum(0) / wsum[have].sum()) if have.any() else np.array([180, 150, 120])
    colours[have, :3] = np.clip(acc[have] / wsum[have, None], 0, 255)
    colours[~have, :3] = fallback
    return colours


# --------------------------------------------------------------------- main ---


def reconstruct(views: dict[str, bytes], progress=lambda stage, pct: None, seed: int = 1234) -> bytes:
    """Six JPEGs keyed by angle -> GLB bytes."""
    import torch
    import trimesh
    from hy3dgen.shapegen import DegenerateFaceRemover, FaceReducer, FloaterRemover

    with _lock:
        progress("loading", 5)
        load()
        progress("preparing", 12)
        cutouts = {a: _cutout(views[a]) for a in ANGLES if a in views}
        shape_in = {SHAPE_VIEWS[a]: cutouts[a] for a in SHAPE_VIEWS if a in cutouts}

        progress("shape", 25)
        t = time.time()
        mesh = _pipeline(
            image=shape_in,
            num_inference_steps=5,          # turbo model: 5 steps
            octree_resolution=256,          # detail vs. memory on 16 GB
            num_chunks=8000,
            generator=torch.manual_seed(seed),
            output_type="trimesh",
        )[0]
        log.info("shape in %.1fs, %d faces", time.time() - t, len(mesh.faces))

        progress("cleanup", 75)
        mesh = FloaterRemover()(mesh)
        mesh = DegenerateFaceRemover()(mesh)
        mesh = FaceReducer()(mesh, max_facenum=40000)
        if not isinstance(mesh, trimesh.Trimesh):
            mesh = trimesh.Trimesh(mesh.vertices, mesh.faces)

        progress("colour", 85)
        calib = _calibrate(mesh, cutouts)
        log.info("view calibration: %s", {k: (v["score"]) for k, v in calib.items()})
        mesh.visual = trimesh.visual.ColorVisuals(mesh, vertex_colors=_colour(mesh, cutouts, calib))

        progress("export", 95)
        glb = mesh.export(file_type="glb")
        if torch.backends.mps.is_available():
            torch.mps.empty_cache()
        return glb


if __name__ == "__main__":  # quick manual run: python reconstruct.py <dir with front.jpg ...> out.glb
    import sys

    logging.basicConfig(level=logging.INFO)
    src, out = sys.argv[1], sys.argv[2]
    views = {a: open(os.path.join(src, f"{a}.jpg"), "rb").read() for a in ANGLES if os.path.exists(os.path.join(src, f"{a}.jpg"))}
    t = time.time()
    data = reconstruct(views, progress=lambda s, p: print(f"[{p:3d}%] {s}", flush=True))
    open(out, "wb").write(data)
    print(f"wrote {out}: {len(data)/1e6:.2f} MB in {time.time()-t:.0f}s")
