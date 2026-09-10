"""Sales-channel registry — "Publish once. Reach every channel."

Honesty matters here: ONDC is a **real** channel (we build a schema-correct
ONDC:RET10 catalog + a live storefront and QR). The third-party marketplaces
(Meesho, Myntra, Amazon Karigar, Flipkart Samarth, WhatsApp Business) do NOT
expose a public seller API to cross-post by phone number, so they are built as
clearly-labelled **demo adapters**: they record a per-listing publish *intent*
with a synthetic reference and a believable status, and never call an external
API or collect any credential.
"""
from __future__ import annotations

import uuid

# kind: "live"  → really published (ONDC)
#       "demo"  → simulated adapter, recorded locally, clearly labelled
_CHANNELS: list[dict] = [
    {
        "id": "ondc",
        "name": "ONDC",
        "kind": "live",
        "logo": "🟢",
        "note": "Open Network for Digital Commerce — a real, schema-correct catalog + storefront.",
    },
    {
        "id": "meesho",
        "name": "Meesho",
        "kind": "demo",
        "logo": "🛍️",
        "note": "Simulated for the prototype — real seller-API integration is on the roadmap.",
    },
    {
        "id": "myntra",
        "name": "Myntra",
        "kind": "demo",
        "logo": "👗",
        "note": "Simulated for the prototype — real seller-API integration is on the roadmap.",
    },
    {
        "id": "amazon_karigar",
        "name": "Amazon Karigar",
        "kind": "demo",
        "logo": "📦",
        "note": "Simulated for the prototype — real seller-API integration is on the roadmap.",
    },
    {
        "id": "flipkart_samarth",
        "name": "Flipkart Samarth",
        "kind": "demo",
        "logo": "🛒",
        "note": "Simulated for the prototype — real seller-API integration is on the roadmap.",
    },
    {
        "id": "whatsapp",
        "name": "WhatsApp Business",
        "kind": "demo",
        "logo": "💬",
        "note": "Simulated for the prototype — WhatsApp Business catalog API is on the roadmap.",
    },
]

_BY_ID = {c["id"]: c for c in _CHANNELS}


def all_channels() -> list[dict]:
    """The registry, as plain dicts (id, name, kind, logo, note)."""
    return [dict(c) for c in _CHANNELS]


def get_channel(channel_id: str) -> dict | None:
    c = _BY_ID.get(channel_id)
    return dict(c) if c else None


def is_live(channel_id: str) -> bool:
    return _BY_ID.get(channel_id, {}).get("kind") == "live"


def synthetic_ref(channel_id: str) -> str:
    """A believable per-channel reference for a demo publish."""
    prefix = channel_id.split("_")[0][:3].upper()
    return f"{prefix}-{uuid.uuid4().hex[:8].upper()}"


def demo_status(channel_id: str) -> str:
    name = _BY_ID.get(channel_id, {}).get("name", channel_id)
    return f"Published to {name} (demo)"
