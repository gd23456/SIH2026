"""Grounded Fair-Price engine.

The LLM/mock gives a plausible number, but a judge will ask *"how do you know
₹749 is fair?"*. This module answers that by blending three independent signals
and being explicit about which ones fired:

  1. the LLM/mock estimate (creative, context-aware),
  2. an observed market band from ``comparables.json`` (what similar handmade
     items actually sell for — the reality check), and
  3. a minimum **fair-wage floor** — ``labour_days × DAILY_FAIR_WAGE`` — below
     which the engine will never price, so the number can never drop under the
     artisan's own labour cost. This is the social-impact guarantee.

Everything degrades gracefully: no comparable match just means the market
signal is skipped, and the wage floor uses a sensible default day count.
"""
from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path

from . import gemini_service, gi_service

# A registry-verified GI is worth more than a generic equivalent — a verified
# Channapatna toy should not be priced like any wooden toy. Modest, honest bump.
GI_PREMIUM_MULTIPLIER = 1.15

# A day of skilled artisan labour, in INR. Anchored to a fair rural craft wage
# (above the ~₹300–350 MGNREGA floor most states pay). The suggested price can
# never fall below labour_days × this — that is the fairness guarantee.
DAILY_FAIR_WAGE = 400

# Weight given to the observed market median when a comparable category matches.
# The rest of the weight stays on the LLM estimate. Kept < 0.5 so the AI's
# context (materials, GI, technique) still leads, with the market as ballast.
_MARKET_WEIGHT = 0.45

_DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "comparables.json"

# Keywords that route a listing to a comparables category. Scanned in order, so
# more specific crafts come before broad materials ("silk" before "wood").
_MATCH_KEYWORDS: list[tuple[str, list[str]]] = [
    ("Handloom Silk Saree", ["silk", "saree", "sari", "handloom", "zari",
                              "mysore silk", "kanjeevaram", "kanchipuram", "pochampally"]),
    ("Channapatna Wooden Toys", ["channapatna", "wooden toy", "wooden-toy", "toy",
                                 "lacquer", "spinning top", "kondapalli"]),
    ("Bamboo & Cane Storage", ["bamboo", "cane", "basket", "wicker", "storage"]),
    ("Terracotta & Pottery Decor", ["terracotta", "pottery", "clay", "vase",
                                    "pot", "ceramic", "earthen"]),
    ("Jute Bags", ["jute", "tote", "sack", "burlap"]),
    ("Brassware & Metal Craft", ["brass", "bidri", "bidriware", "dhokra",
                                 "bronze", "metal", "bell metal"]),
    # Ahead of jewellery and the generic wood catch: a carved wooden jewellery box
    # is woodwork, not jewellery, and without this it was priced against a toy
    # band (median Rs.640) or a jewellery band it does not belong in.
    ("Carved Wood & Furniture", ["carved", "carving", "furniture", "chest", "sheesham",
                                 "rosewood", "saharanpur", "walnut wood", "jewellery box"]),
    ("Handmade Jewellery", ["jewellery", "jewelry", "necklace", "earring", "bangle",
                            "pendant", "filigree", "meenakari", "kundan", "tarakasi"]),
    ("Folk & Tribal Painting", ["painting", "madhubani", "mithila", "pattachitra",
                                "warli", "kalamkari", "gond", "tanjore", "phad"]),
    ("Carpets & Durries", ["carpet", "rug", "durrie", "dhurrie", "namda"]),
    ("Embroidered Textiles", ["chikankari", "phulkari", "kantha", "kasuti", "zardozi",
                              "embroidery", "embroidered", "shawl", "dupatta"]),
    ("Leather Craft", ["leather", "kolhapuri", "chappal", "mojari", "jutti"]),
    ("Stone & Marble Craft", ["marble", "soapstone", "stone carving", "inlay"]),
    ("Papier-mache & Lacquerware", ["papier", "mache", "lacquerware"]),
    # Generic wood/handicraft catch that still finds a band before we fall back.
    # Small plain wooden objects sit closer to the toy band than to furniture.
    ("Channapatna Wooden Toys", ["wood", "wooden"]),
]


@lru_cache(maxsize=1)
def _comparables() -> dict:
    try:
        return json.loads(_DATA_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def _match_category(payload: dict) -> tuple[str | None, dict | None]:
    """Return (category_name, band) for the listing, or (None, default band)."""
    comps = _comparables()
    haystack = " ".join(
        str(payload.get(k, "")) for k in ("title", "category", "material", "craft_technique")
    ).lower()

    for name, keywords in _MATCH_KEYWORDS:
        if name in comps and any(kw in haystack for kw in keywords):
            return name, comps[name]

    return None, comps.get("default")


def _days_from(text: str) -> int:
    m = re.search(r"(\d+)", str(text) or "")
    return max(1, int(m.group(1))) if m else 2


def _rescale_breakdown(breakdown: list[dict], target: int) -> list[dict]:
    """Scale an existing breakdown so its amounts sum exactly to ``target``."""
    rows = [
        {"label": str(b.get("label", "")), "amount": max(0, int(b.get("amount", 0) or 0))}
        for b in (breakdown or [])
        if b.get("label")
    ]
    if not rows:
        # Build a sensible default decomposition.
        materials, labour, skill = (
            int(target * 0.35), int(target * 0.40), int(target * 0.20),
        )
        rows = [
            {"label": "Materials", "amount": materials},
            {"label": "Labour", "amount": labour},
            {"label": "Skill premium", "amount": skill},
            {"label": "Platform + shipping", "amount": target - materials - labour - skill},
        ]
        return rows

    total = sum(r["amount"] for r in rows) or 1
    scaled = [{"label": r["label"], "amount": int(round(r["amount"] * target / total))} for r in rows]
    # Push any rounding drift onto the last row so the sum is exact.
    drift = target - sum(r["amount"] for r in scaled)
    scaled[-1]["amount"] = max(0, scaled[-1]["amount"] + drift)
    return scaled


def fair_price(payload: dict) -> dict:
    """Blend LLM + market + wage-floor into one grounded, explainable price."""
    data = gemini_service.estimate_price(payload)

    # Clean ints from whatever the model/mock produced.
    for k in ("suggested_price", "min_price", "max_price"):
        try:
            data[k] = int(round(float(data.get(k, 0))))
        except (TypeError, ValueError):
            data[k] = 0
    data.setdefault("currency", "INR")
    data.setdefault("reasoning", [])
    data.setdefault("breakdown", [])
    data.setdefault("market_note", "")

    llm_estimate = data["suggested_price"]

    # --- signal 2: observed market band -----------------------------------
    category, band = _match_category(payload)
    market_median = int(band["median"]) if band else 0
    market_sample_count = int(band["sample_count"]) if band else 0
    market_source = str(band["source"]) if band else ""

    if market_median > 0 and llm_estimate > 0:
        blended = round((1 - _MARKET_WEIGHT) * llm_estimate + _MARKET_WEIGHT * market_median)
    else:
        blended = llm_estimate or market_median

    # --- signal 3: fair-wage floor ----------------------------------------
    labour_days = _days_from(payload.get("production_time", "2 days"))
    wage_floor = labour_days * DAILY_FAIR_WAGE
    wage_floor_applied = wage_floor > blended

    suggested = max(blended, wage_floor)

    # --- verified-GI premium ----------------------------------------------
    gi = gi_service.verify(payload)
    gi_verified = gi["matched"]
    gi_premium_applied = False
    if gi_verified:
        suggested = int(round(suggested * GI_PREMIUM_MULTIPLIER))
        gi_premium_applied = True

    # Price band around the final number, never dipping below the wage floor.
    min_price = max(wage_floor, int(round(suggested * 0.85)))
    max_price = int(round(suggested * 1.35))
    if band:
        max_price = max(max_price, int(band["band_high"]))
    min_price = min(min_price, suggested)  # guard: min ≤ suggested always
    max_price = max(max_price, suggested)

    # --- explainability ----------------------------------------------------
    reasoning: list[str] = []
    if market_median > 0:
        reasoning.append(
            f"Market check: median ₹{market_median:,} across {market_sample_count} "
            f"similar {(category or 'handmade').lower()} listings."
        )
    reasoning.append(
        f"Fair-wage floor: {labour_days} day(s) × ₹{DAILY_FAIR_WAGE}/day = ₹{wage_floor:,} "
        + ("— binding, so the price was raised to protect the artisan's labour."
           if wage_floor_applied
           else "— the suggested price already clears it.")
    )
    if gi_premium_applied:
        reasoning.append(
            f"Verified GI premium (+{round((GI_PREMIUM_MULTIPLIER - 1) * 100)}%): "
            f"{gi['name']} is a registered Geographical Indication from {gi['state']} — "
            "priced above a generic equivalent."
        )
    # Preserve the model's own reasoning bullets after our grounding notes.
    for bullet in data.get("reasoning", []):
        if bullet and bullet not in reasoning:
            reasoning.append(str(bullet))

    market_note = data.get("market_note") or (
        f"Grounded against {market_sample_count} comparable listings and a fair-wage floor."
        if market_median > 0
        else "Priced to protect the artisan's margin while staying competitive."
    )

    return {
        "suggested_price": suggested,
        "min_price": min_price,
        "max_price": max_price,
        "currency": data.get("currency", "INR"),
        "reasoning": reasoning,
        "breakdown": _rescale_breakdown(data.get("breakdown", []), suggested),
        "market_note": market_note,
        "market_median": market_median,
        "market_sample_count": market_sample_count,
        "market_source": market_source,
        "wage_floor": wage_floor,
        "wage_floor_applied": wage_floor_applied,
        "gi_verified": gi_verified,
        "gi_premium_applied": gi_premium_applied,
    }
