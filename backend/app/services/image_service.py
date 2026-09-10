"""AI Photo Studio: background removal + professional clarity.

Uses rembg (U^2-Net) when available for true background removal, then composites
the cutout onto a clean studio gradient and applies tasteful clarity — white
balance, auto contrast, mild denoise and unsharp — so the product looks crisp
and professional, not oversaturated or cartoonish. If rembg/onnxruntime aren't
installed we still return an enhanced, studio-backed image so the demo works.
"""
from __future__ import annotations

import base64
import io
import logging
import threading

from PIL import Image, ImageEnhance, ImageFilter, ImageOps, ImageStat

log = logging.getLogger("karigar.image")

_CANVAS = (1024, 1024)
# Huge phone photos (4000px+) are slow through rembg and the filters; cap the
# working size first. Big enough to keep detail, small enough to stay fast.
_WORK_MAX = 1600


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


def _white_balance(img: Image.Image) -> Image.Image:
    """Gentle gray-world white balance — kills yellow/blue workshop-light casts.

    Scales are clamped to ±20% so a legitimately warm terracotta doesn't get
    neutralised into something grey.
    """
    stat = ImageStat.Stat(img)
    avg = stat.mean[:3]
    gray = sum(avg) / 3.0 or 1.0
    scales = [min(max(gray / (a or 1.0), 0.8), 1.2) for a in avg]
    r, g, b = img.split()[:3]
    r = r.point(lambda v: min(255, int(v * scales[0])))
    g = g.point(lambda v: min(255, int(v * scales[1])))
    b = b.point(lambda v: min(255, int(v * scales[2])))
    return Image.merge("RGB", (r, g, b))


def _apply_clarity(rgb: Image.Image) -> Image.Image:
    """White balance → auto contrast → mild denoise → unsharp → gentle pop.

    Ordering matters: denoise before sharpening so we don't amplify sensor
    noise, and keep colour/contrast boosts small so it reads as 'a good photo',
    not an over-processed filter.
    """
    rgb = _white_balance(rgb)
    rgb = ImageOps.autocontrast(rgb, cutoff=1)
    rgb = rgb.filter(ImageFilter.MedianFilter(size=3))              # mild denoise
    rgb = rgb.filter(ImageFilter.UnsharpMask(radius=2, percent=115, threshold=3))
    rgb = ImageEnhance.Color(rgb).enhance(1.06)                     # subtle, not garish
    rgb = ImageEnhance.Contrast(rgb).enhance(1.04)
    return rgb


def _clarify_cutout(cutout: Image.Image) -> Image.Image:
    """Apply clarity to an RGBA cutout while preserving its alpha channel."""
    r, g, b, a = cutout.split()
    rgb = _apply_clarity(Image.merge("RGB", (r, g, b)))
    return Image.merge("RGBA", (*rgb.split(), a))


def _fit_onto_studio(cutout: Image.Image) -> Image.Image:
    """Center a (possibly transparent) cutout on the studio background."""
    canvas = _studio_background(_CANVAS).convert("RGBA")
    max_side = int(_CANVAS[0] * 0.82)
    cw, ch = cutout.size
    scale = min(max_side / cw, max_side / ch)
    new = cutout.resize((max(1, int(cw * scale)), max(1, int(ch * scale))), Image.LANCZOS)
    x = (_CANVAS[0] - new.size[0]) // 2
    y = (_CANVAS[1] - new.size[1]) // 2
    canvas.alpha_composite(new.convert("RGBA"), (x, y))
    return canvas.convert("RGB")


# rembg's remove() defaults to the bria-rmbg model (~1GB, non-commercial licence)
# and builds a fresh session on every call, reloading the weights each request
# (~30s per photo). u2net is ~180MB, Apache-2.0, and ~0.5s once loaded.
_REMBG_MODEL = "u2net"
_session = None
_session_lock = threading.Lock()


def _rembg_session():
    """Build the rembg session once and reuse it across requests."""
    global _session
    if _session is None:
        with _session_lock:
            if _session is None:
                from rembg import new_session  # heavy import; optional

                _session = new_session(_REMBG_MODEL)
                log.info("rembg session ready (%s)", _REMBG_MODEL)
    return _session


def enhance_image(raw: bytes) -> dict:
    """Return {original_b64, enhanced_b64, bg_removed: bool}."""
    src = Image.open(io.BytesIO(raw))
    # Honour camera EXIF rotation (phones store portrait shots rotated).
    src = ImageOps.exif_transpose(src).convert("RGB")
    # Cap working size for speed on big phone photos.
    src.thumbnail((_WORK_MAX, _WORK_MAX), Image.LANCZOS)

    # A smaller copy for the "before" payload.
    before = src.copy()
    before.thumbnail((1024, 1024), Image.LANCZOS)
    original_b64 = _to_b64(before)

    bg_removed = False
    cutout = None
    try:
        from rembg import remove  # heavy import; optional

        out = remove(src, session=_rembg_session())  # RGBA
        cutout = out if isinstance(out, Image.Image) else Image.open(io.BytesIO(out))
        cutout = cutout.convert("RGBA")
        bg_removed = True
    except Exception as e:
        log.info("rembg unavailable, enhancing without cutout: %s", e)

    if cutout is not None:
        composed = _fit_onto_studio(_clarify_cutout(cutout))
    else:
        # No cutout: clarify the whole photo, then place it on the studio bg.
        composed = _fit_onto_studio(_apply_clarity(src).convert("RGBA"))

    return {
        "original_b64": original_b64,
        "enhanced_b64": _to_b64(composed),
        "bg_removed": bg_removed,
    }


def _to_b64(img: Image.Image, fmt: str = "PNG") -> str:
    if img.mode != "RGB":
        img = img.convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format=fmt, optimize=True)
    return base64.b64encode(buf.getvalue()).decode("ascii")
