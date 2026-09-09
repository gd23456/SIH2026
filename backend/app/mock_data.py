"""Realistic fallback data so the demo works with zero API keys / offline.

The mock is keyword-aware: it reads the artisan's transcript and produces a
plausible, well-formed listing. It is intentionally good enough to demo on
stage if the network or key fails.
"""
from __future__ import annotations

import re

# Lightweight bilingual snippets used to fake multilingual generation.
_HI = {
    "Handwoven": "हस्तनिर्मित", "Handmade": "हस्तनिर्मित", "Bamboo": "बाँस",
    "Basket": "टोकरी", "Pottery": "मिट्टी के बर्तन", "Vase": "फूलदान",
    "Silk": "रेशम", "Saree": "साड़ी", "Wooden": "लकड़ी", "Toy": "खिलौना",
    "Jute": "जूट", "Bag": "बैग", "Brass": "पीतल", "Lamp": "दीपक",
    "Storage": "भंडारण", "Set": "सेट", "with": "के साथ",
}
_KN = {
    "Handwoven": "ಕೈಮಗ್ಗ", "Handmade": "ಕೈಯಿಂದ ಮಾಡಿದ", "Bamboo": "ಬಿದಿರು",
    "Basket": "ಬುಟ್ಟಿ", "Pottery": "ಮಣ್ಣಿನ ಪಾತ್ರೆ", "Vase": "ಹೂದಾನಿ",
    "Silk": "ರೇಷ್ಮೆ", "Saree": "ಸೀರೆ", "Wooden": "ಮರದ", "Toy": "ಆಟಿಕೆ",
    "Jute": "ಸೆಣಬು", "Bag": "ಚೀಲ", "Brass": "ಹಿತ್ತಾಳೆ", "Lamp": "ದೀಪ",
    "Storage": "ಸಂಗ್ರಹ", "Set": "ಸೆಟ್", "with": "ಜೊತೆ",
}

CRAFTS = [
    {
        "keys": ["bamboo", "basket", "cane", "बाँस", "टोकरी", "ಬಿದಿರು", "ಬುಟ್ಟಿ"],
        "title": "Handwoven Bamboo Storage Basket",
        "material": "Natural Bamboo",
        "category": "Home & Living / Storage",
        "craft_technique": "Traditional hand-weaving",
        "production_time": "3 days",
        "dimensions": "30 × 30 × 25 cm",
        "tags": ["handmade", "eco-friendly", "bamboo", "storage", "sustainable", "artisan"],
        "gi_candidate": None,
        "desc": "A beautifully handwoven storage basket crafted from natural bamboo by skilled rural artisans. Each basket is made over three days using traditional hand-weaving techniques passed down through generations. Durable, lightweight, and fully biodegradable — perfect for eco-conscious homes.",
        "base_price": 749,
    },
    {
        "keys": ["pottery", "clay", "terracotta", "vase", "pot", "मिट्टी", "ಮಣ್ಣಿನ"],
        "title": "Hand-thrown Terracotta Vase",
        "material": "Natural Terracotta Clay",
        "category": "Home & Living / Decor",
        "craft_technique": "Wheel-thrown & sun-dried",
        "production_time": "4 days",
        "dimensions": "25 cm height",
        "tags": ["handmade", "terracotta", "pottery", "home-decor", "eco-friendly"],
        "gi_candidate": None,
        "desc": "An elegant hand-thrown terracotta vase shaped on a traditional potter's wheel and finished by hand. Natural clay tones and a matte earthen texture make each piece unique. Crafted over four days by a master potter.",
        "base_price": 899,
    },
    {
        "keys": ["silk", "saree", "sari", "weave", "रेशम", "साड़ी", "ರೇಷ್ಮೆ", "ಸೀರೆ"],
        "title": "Handloom Mysore Silk Saree",
        "material": "Pure Mulberry Silk with Gold Zari",
        "category": "Clothing / Ethnic Wear",
        "craft_technique": "Traditional handloom weaving",
        "production_time": "12 days",
        "dimensions": "6.3 metres with blouse piece",
        "tags": ["handloom", "silk", "saree", "mysore-silk", "zari", "heritage"],
        "gi_candidate": "Mysore Silk (GI)",
        "desc": "A resplendent handloom saree woven from pure mulberry silk with genuine gold zari borders. Hand-woven over twelve days in the Mysore tradition, celebrated for its lustrous finish and enduring craftsmanship.",
        "base_price": 8499,
    },
    {
        "keys": ["wooden", "toy", "channapatna", "wood", "लकड़ी", "खिलौना", "ಮರದ", "ಆಟಿಕೆ"],
        "title": "Channapatna Wooden Spinning Top Set",
        "material": "Ivory-wood (Wrightia tinctoria) with natural lac colours",
        "category": "Toys & Games",
        "craft_technique": "Lacquer-turnery (Channapatna)",
        "production_time": "2 days",
        "dimensions": "Set of 4, 6–9 cm each",
        "tags": ["channapatna", "wooden-toys", "handmade", "non-toxic", "kids", "heritage"],
        "gi_candidate": "Channapatna Toys (GI)",
        "desc": "A vibrant set of hand-turned wooden spinning tops made in the famed Channapatna tradition, coloured with safe natural lac dyes. Non-toxic and lovingly finished — a piece of Karnataka's toy-making heritage.",
        "base_price": 649,
    },
]

_DEFAULT = {
    "title": "Handcrafted Artisan Product",
    "material": "Natural handcrafted materials",
    "category": "Handicrafts",
    "craft_technique": "Traditional handcraft",
    "production_time": "2 days",
    "dimensions": "Standard",
    "tags": ["handmade", "artisan", "handicraft", "traditional", "india"],
    "gi_candidate": None,
    "desc": "A one-of-a-kind handcrafted piece made by a skilled artisan using traditional techniques and natural materials. Every item is unique and made with care.",
    "base_price": 599,
}


def _translate(text: str, table: dict[str, str]) -> str:
    out = text
    for en, tr in table.items():
        out = re.sub(rf"\b{re.escape(en)}\b", tr, out)
    return out


def match_craft(transcript: str) -> dict:
    t = (transcript or "").lower()
    for c in CRAFTS:
        if any(k in t for k in c["keys"]):
            return c
    return _DEFAULT


def mock_listing(transcript: str) -> dict:
    c = match_craft(transcript)
    title = c["title"]
    desc = c["desc"]
    return {
        "title": {"en": title, "hi": _translate(title, _HI), "kn": _translate(title, _KN)},
        "description": {
            "en": desc,
            "hi": _translate(desc, _HI),
            "kn": _translate(desc, _KN),
        },
        "material": c["material"],
        "category": c["category"],
        "craft_technique": c["craft_technique"],
        "production_time": c["production_time"],
        "dimensions": c["dimensions"],
        "tags": c["tags"],
        "gi_candidate": c["gi_candidate"],
        "_base_price": c["base_price"],
    }


def mock_price(listing: dict) -> dict:
    # Anchor the suggested price to a realistic value for the craft, then
    # decompose it into an explainable breakdown that sums back to it.
    suggested = int(listing.get("_base_price") or _DEFAULT["base_price"])
    days = _days_from(listing.get("production_time", "2 days"))
    materials = int(suggested * 0.35)
    labour = int(suggested * 0.40)
    skill = int(suggested * 0.20)
    platform = suggested - materials - labour - skill  # remainder keeps the sum exact
    return {
        "suggested_price": max(suggested, 199),
        "min_price": int(suggested * 0.85),
        "max_price": int(suggested * 1.35),
        "currency": "INR",
        "reasoning": [
            f"Materials (~35%): {listing.get('material','natural materials')} → ₹{materials}",
            f"Labour: {days} day(s) of skilled handwork → ₹{labour}",
            "Skill premium for traditional handcraft (~20%)",
            f"Comparable handmade listings in this category sell for ₹{int(suggested * 0.85)}–₹{int(suggested * 1.35)}",
        ],
        "breakdown": [
            {"label": "Materials", "amount": materials},
            {"label": "Labour", "amount": labour},
            {"label": "Skill premium", "amount": skill},
            {"label": "Platform + shipping", "amount": platform},
        ],
        "market_note": "Priced to protect the artisan's margin while staying competitive with mass-market alternatives.",
    }


def _days_from(text: str) -> int:
    m = re.search(r"(\d+)", text or "")
    return int(m.group(1)) if m else 2
