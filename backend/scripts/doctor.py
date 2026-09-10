"""Integrations doctor — confirm every live API is wired, in one command.

    python scripts/doctor.py            # from backend/
    python backend/scripts/doctor.py    # from repo root

Prints each integration's status and does a lightweight LIVE ping of Gemini
(one tiny call) — reporting OK or the exact reason it isn't live. Never changes
anything; safe to run any time.
"""
from __future__ import annotations

import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")  # Windows consoles default to cp1252
except Exception:
    pass

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services import gemini_service, integrations  # noqa: E402


def _line(label: str, value: str) -> None:
    print(f"  {label:<12} {value}")


def main() -> int:
    st = integrations.status()
    print("\n  🩺 Karigar AI — integrations doctor\n")

    _line("gemini:", st["gemini"])
    _line("rembg:", "installed (real background removal)" if st["rembg"]
          else "not installed (studio-composite fallback — fine)")
    _line("firebase:", st["firebase"] + "  (frontend/.env VITE_FIREBASE_*)")

    print("\n  Live checks:")

    # Gemini — one tiny call.
    if st["gemini"] == "live":
        g = gemini_service.ping()
        if g.get("ok"):
            _line("gemini ping:", f"OK · model={g['model']}")
        else:
            _line("gemini ping:", f"NOT LIVE · {g.get('reason')}")
    else:
        _line("gemini ping:", "skipped — mock mode (set GEMINI_API_KEY for live)")

    print("\n  (Missing integrations are fine — the app degrades to the offline"
          "\n   mock/demo path so the full flow still runs.)\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
