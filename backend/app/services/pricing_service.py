"""Fair-Price engine — thin wrapper over Gemini/mock estimation."""
from __future__ import annotations

from . import gemini_service


def fair_price(payload: dict) -> dict:
    data = gemini_service.estimate_price(payload)
    # Defensive normalisation so the frontend always gets clean ints.
    for k in ("suggested_price", "min_price", "max_price"):
        try:
            data[k] = int(round(float(data.get(k, 0))))
        except (TypeError, ValueError):
            data[k] = 0
    data.setdefault("currency", "INR")
    data.setdefault("reasoning", [])
    data.setdefault("breakdown", [])
    data.setdefault("market_note", "")
    return data
