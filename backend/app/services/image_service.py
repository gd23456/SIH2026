"""AI Photo Studio: background removal + enhancement.

Uses rembg (U^2-Net) when available for true background removal, then
composites the cutout onto a clean studio gradient and applies light
enhancement (contrast, colour, sharpness). If rembg/onnxruntime aren't
installed, we still return an enhanced, studio-backed image so the demo works.
"""
from __future__ import annotations

import base64
import io
import logging

from PIL import Image, ImageEnhance

log = logging.getLogger("karigar.image")

_CANVAS = (1024, 1024)


def _studio_background(size: tuple[int, int]) -> Image.Image:
    """A soft, light studio gradient — flatters product photos."""
    w, h = size
    bg = Image.new("RGB", size, (247, 243, 236))  # warm cream
    top = (255, 253, 248)
    bottom = (232, 224, 210)
    for y in range(h):
        t = y / h
        r = int(top[0] * (1 - t) + bottom[0] * t)
        g = int(top[1] * (1 - t) + bottom[1] * t)
        b = int(top[2] * (1 - t) + bottom[2] * t)
        bg.paste((r, g, b), (0, y, w, y + 1))
    return bg


def _enhance(img: Image.Image) -> Image.Image:
    img = ImageEnhance.Color(img).enhance(1.12)
    img = ImageEnhance.Contrast(img).enhance(1.08)
    img = ImageEnhance.Brightness(img).enhance(1.04)
    img = ImageEnhance.Sharpness(img).enhance(1.25)
    return img


def _fit_onto_studio(cutout: Image.Image) -> Image.Image:
    """Center a (possibly transparent) cutout on the studio background."""
    canvas = _studio_background(_CANVAS).convert("RGBA")
    # scale cutout to ~82% of canvas
    max_side = int(_CANVAS[0] * 0.82)
    cw, ch = cutout.size
    scale = min(max_side / cw, max_side / ch)
    new = cutout.resize((max(1, int(cw * scale)), max(1, int(ch * scale))))
    x = (_CANVAS[0] - new.size[0]) // 2
    y = (_CANVAS[1] - new.size[1]) // 2
    canvas.alpha_composite(new.convert("RGBA"), (x, y))
    return canvas.convert("RGB")


def enhance_image(raw: bytes) -> dict:
    """Return {original_b64, enhanced_b64, bg_removed: bool}."""
    src = Image.open(io.BytesIO(raw)).convert("RGB")
    # cap original size for payload
    src.thumbnail((1024, 1024))
    original_b64 = _to_b64(src)

    bg_removed = False
    cutout = None
    try:
        from rembg import remove  # heavy import; optional

        out = remove(src)  # returns RGBA PIL image
        cutout = out if isinstance(out, Image.Image) else Image.open(io.BytesIO(out))
        cutout = cutout.convert("RGBA")
        bg_removed = True
    except Exception as e:
        log.info("rembg unavailable, enhancing without cutout: %s", e)

    if cutout is not None:
        composed = _fit_onto_studio(cutout)
    else:
        # No cutout: place the whole (enhanced) photo on the studio bg for a cleaner look
        composed = _fit_onto_studio(src.convert("RGBA"))

    enhanced = _enhance(composed)
    return {
        "original_b64": original_b64,
        "enhanced_b64": _to_b64(enhanced),
        "bg_removed": bg_removed,
    }


def _to_b64(img: Image.Image, fmt: str = "PNG") -> str:
    buf = io.BytesIO()
    img.save(buf, format=fmt, optimize=True)
    return base64.b64encode(buf.getvalue()).decode("ascii")
