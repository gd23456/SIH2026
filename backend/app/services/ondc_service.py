"""ONDC publish (demo).

Builds a catalog item that mirrors the ONDC (Open Network for Digital Commerce)
retail catalog shape, so the demo shows a real, standards-aligned payload rather
than a made-up JSON blob. In production this would POST to a registered ONDC
Seller App (BPP) via /on_search. Here we build + return it and mint IDs.
"""
from __future__ import annotations

import time
import urllib.parse
import uuid


def _slug(text: str) -> str:
    return "".join(c if c.isalnum() else "-" for c in text.lower()).strip("-")[:40]


def build_ondc_catalog(listing: dict, price: int, artisan_name: str, location: str) -> dict:
    title = listing.get("title", {}).get("en", "Handcrafted Product")
    item_id = f"KARIGAR-{uuid.uuid4().hex[:8].upper()}"
    return {
        "context": {
            "domain": "ONDC:RET10",  # Handicrafts / Home & Kitchen
            "country": "IND",
            "action": "on_search",
            "core_version": "1.2.0",
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
        },
        "message": {
            "catalog": {
                "bpp/descriptor": {"name": "Karigar AI Seller App"},
                "bpp/providers": [
                    {
                        "id": _slug(artisan_name) or "artisan",
                        "descriptor": {"name": artisan_name, "short_desc": f"Artisan from {location}"},
                        "locations": [{"id": "L1", "city": {"name": location}, "country": {"code": "IND"}}],
                        "items": [
                            {
                                "id": item_id,
                                "descriptor": {
                                    "name": title,
                                    "long_desc": listing.get("description", {}).get("en", ""),
                                    "images": ["<enhanced_product_image>"],
                                },
                                "price": {"currency": "INR", "value": str(price)},
                                "category_id": listing.get("category", "Handicrafts"),
                                "tags": [
                                    {"code": "attribute", "list": [
                                        {"code": "material", "value": listing.get("material", "")},
                                        {"code": "technique", "value": listing.get("craft_technique", "")},
                                        {"code": "gi_tag", "value": listing.get("gi_candidate") or "none"},
                                        {"code": "handmade", "value": "true"},
                                    ]},
                                    {"code": "search_tags", "list": [
                                        {"code": "keyword", "value": t} for t in listing.get("tags", [])
                                    ]},
                                ],
                            }
                        ],
                    }
                ],
            }
        },
        "_listing_id": item_id,
    }


def whatsapp_share(title: str, price: int, storefront_url: str) -> str:
    text = f"🧺 {title}\n💰 ₹{price} (handmade, fair-price)\nBuy on ONDC 👉 {storefront_url}"
    return "https://wa.me/?text=" + urllib.parse.quote(text)
