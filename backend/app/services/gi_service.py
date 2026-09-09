"""GI-tag verification against the registered-GI registry.

This is deliberately distinct from the LLM's ``gi_candidate`` guess. The LLM
*suggests* a Geographical Indication; this service *verifies* it by fuzzy-
matching the listing text against a curated registry of real registered GIs
(``data/gi_registry.json``). A verified match is what earns the green
"✓ Verified GI" badge and the price premium — an unverified guess does not.

Pure stdlib (``difflib``) on purpose: no new dependency, works offline.
"""
from __future__ import annotations

import json
import re
from difflib import SequenceMatcher
from functools import lru_cache
from pathlib import Path

_DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "gi_registry.json"

# A match must clear this token-overlap-weighted similarity to count. High
# enough that "wooden box" does NOT verify as any GI, low enough that
# "Channapatna wooden toy" matches "Channapatna Toys and Dolls".
_CUTOFF = 0.6

# Craft categories only — a GI is meaningless for these registry rows, and
# matching a saree against "Ratlami Sev" would be nonsense.
_NON_CRAFT = {"Agriculture", "Foodstuff"}

_STOP = {
    "the", "and", "of", "with", "a", "an", "handmade", "hand", "made",
    "traditional", "natural", "pure", "set", "craft", "work", "product",
    "products", "fabrics", "saree", "sarees", "doll", "dolls", "toys",
}


def _tokens(text: str) -> set[str]:
    return {w for w in re.split(r"[^a-z0-9]+", (text or "").lower()) if len(w) > 2 and w not in _STOP}


@lru_cache(maxsize=1)
def _registry() -> list[dict]:
    try:
        data = json.loads(_DATA_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []
    return [
        row
        for row in data.get("registry", [])
        if row.get("name") and row.get("category") not in _NON_CRAFT
    ]


def _score(hay: str, hay_tokens: set[str], entry_name: str) -> float:
    """Similarity of a listing (hay) to one registry name.

    Combines a distinctive-token overlap (so the place/craft word carries the
    match) with a whole-string ratio (so near-exact names score high).
    """
    name_tokens = _tokens(entry_name)
    if not name_tokens:
        return 0.0
    overlap = len(hay_tokens & name_tokens) / len(name_tokens)
    ratio = SequenceMatcher(None, hay, entry_name.lower()).ratio()
    return max(overlap, 0.5 * overlap + 0.5 * ratio)


def verify(listing: dict) -> dict:
    """Verify a listing against the GI registry.

    Reads title + material + craft_technique + gi_candidate + category. Returns
    ``{matched, name, state, confidence}``; ``matched`` is False with empty
    name/state when nothing clears the cutoff.
    """
    title = listing.get("title")
    if isinstance(title, dict):
        title = title.get("en", "")
    hay = " ".join(
        str(listing.get(k, "") or "")
        for k in ("gi_candidate", "material", "craft_technique", "category")
    )
    hay = f"{title} {hay}".lower()
    hay_tokens = _tokens(hay)

    best: dict | None = None
    best_score = 0.0
    for entry in _registry():
        s = _score(hay, hay_tokens, entry["name"])
        if s > best_score:
            best_score, best = s, entry

    if best is None or best_score < _CUTOFF:
        return {"matched": False, "name": "", "state": "", "confidence": round(best_score, 2)}

    return {
        "matched": True,
        "name": best["name"],
        "state": best["state"],
        "category": best.get("category", ""),
        "confidence": round(min(best_score, 0.99), 2),
    }
