"""One place to answer "what's actually wired up?" for every integration.

Used by GET /api/health and scripts/doctor.py so the team can confirm live
status in one shot. Every check is cheap and never raises — a missing
integration reports "off"/False, it does not break the endpoint.
"""
from __future__ import annotations

import importlib.util
from pathlib import Path

from ..config import get_settings
from . import shopify_service

# backend/app/services/integrations.py → parents[3] is the repo root.
_REPO_ROOT = Path(__file__).resolve().parents[3]


def rembg_available() -> bool:
    """True if rembg is importable (real background removal). Cheap: no import."""
    return importlib.util.find_spec("rembg") is not None


def gemini_status() -> str:
    return "mock" if get_settings().use_mock else "live"


def shopify_status() -> str:
    return "configured" if shopify_service.is_configured() else "off"


def firebase_status() -> str:
    """Best-effort dev-time signal: is a Firebase web key set in frontend/.env?

    Firebase auth is a frontend concern (VITE_* baked at build), so the backend
    can only heuristically report it by peeking at the sibling env file.
    """
    env = _REPO_ROOT / "frontend" / ".env"
    try:
        for line in env.read_text(encoding="utf-8").splitlines():
            s = line.strip()
            if s.startswith("VITE_FIREBASE_API_KEY=") and s.split("=", 1)[1].strip():
                return "configured"
    except OSError:
        pass
    return "off"


def status() -> dict:
    """The integrations block surfaced on /api/health."""
    return {
        "gemini": gemini_status(),
        "rembg": rembg_available(),
        "shopify": shopify_status(),
        "firebase": firebase_status(),
    }
