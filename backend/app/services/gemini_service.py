"""Gemini-backed generation with automatic mock fallback.

If GEMINI_API_KEY is set and the SDK is installed, we call Gemini for
multilingual listing generation and price reasoning. On ANY failure
(no key, quota, network, parse error) we transparently fall back to the
keyword-aware mock so the flow never breaks during a live demo.
"""
from __future__ import annotations

import base64
import json
import logging

from .. import mock_data
from ..config import get_settings

log = logging.getLogger("karigar.gemini")

_LANG_NAME = {
    "en": "English", "hi": "Hindi", "kn": "Kannada", "ta": "Tamil",
    "te": "Telugu", "bn": "Bengali", "mr": "Marathi", "gu": "Gujarati", "or": "Odia",
}
# Languages every listing always carries.
_ALWAYS = ("en", "hi", "kn")

# Model names move faster than hackathons do. If the configured model isn't
# available on a teammate's key, we walk down this list rather than silently
# dropping to mock — a wrong model name should not cost us the live AI demo.
_FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]

# Remembers the model that actually worked, so we pay the discovery cost once.
_resolved_model: str | None = None


def _candidates() -> list[str]:
    """Configured model first, then the known-good fallbacks, de-duplicated."""
    s = get_settings()
    ordered = [s.GEMINI_MODEL, *_FALLBACK_MODELS]
    seen: set[str] = set()
    return [m for m in ordered if m and not (m in seen or seen.add(m))]


def _generate(parts: list) -> str | None:
    """Call Gemini, trying each candidate model. Returns raw text, or None.

    Returning None (rather than raising) is deliberate: every caller has a
    mock fallback, and on stage a degraded listing beats a 500.
    """
    global _resolved_model
    s = get_settings()
    if s.use_mock:
        return None

    try:
        import google.generativeai as genai

        genai.configure(api_key=s.GEMINI_API_KEY)
    except Exception as e:
        log.warning("Gemini SDK unavailable, using mock: %s", e)
        return None

    # A model we've already proven works goes first.
    models = _candidates()
    if _resolved_model:
        models = [_resolved_model, *[m for m in models if m != _resolved_model]]

    last_error: Exception | None = None
    for name in models:
        try:
            resp = genai.GenerativeModel(name).generate_content(parts)
            text = resp.text
            if _resolved_model != name:
                log.info("Gemini using model: %s", name)
                _resolved_model = name
            return text
        except Exception as e:
            last_error = e
            log.warning("Gemini model %s failed (%s), trying next", name, e)

    log.warning("All Gemini models failed, using mock. Last error: %s", last_error)
    return None


def active_model() -> str:
    """The model actually in use — surfaced on /api/health for debugging."""
    if get_settings().use_mock:
        return "mock"
    return _resolved_model or f"{get_settings().GEMINI_MODEL} (unverified)"


_LISTING_PROMPT = """You are an e-commerce cataloguing assistant for Indian artisans who
sell handicrafts. An artisan just described their product by voice in {lang}.

Their words: "{transcript}"

{image_hint}

Produce a polished, marketplace-ready product listing. Return STRICT JSON only,
no markdown, with exactly this shape:
{{
  "title": {{{title_shape}}},
  "description": {{{title_shape}}},
  "material": "...",
  "category": "...",
  "craft_technique": "...",
  "production_time": "...",
  "dimensions": "...",
  "tags": ["...", "..."],
  "gi_candidate": null
}}

Rules:
- Titles: 4-8 words, appealing, specific.
- Descriptions: 2-3 warm sentences highlighting handmade quality, materials and heritage.
- Translate title AND description faithfully into these languages: {lang_list}.
- "gi_candidate": if the craft clearly matches a known Indian Geographical Indication
  (e.g. "Channapatna Toys", "Mysore Silk", "Blue Pottery of Jaipur"), put its name; else null.
- tags: 5-7 lowercase keywords useful for marketplace search.
"""

_PRICE_PROMPT = """You help Indian artisans price handmade products fairly — high enough to
respect their labour, low enough to sell. Product:
- Title: {title}
- Material: {material}
- Category: {category}
- Technique: {craft_technique}
- Production time: {production_time}

Return STRICT JSON only:
{{
  "suggested_price": <int INR>,
  "min_price": <int INR>,
  "max_price": <int INR>,
  "currency": "INR",
  "reasoning": ["short bullet", "short bullet", "short bullet"],
  "breakdown": [{{"label":"Materials","amount":<int>}},{{"label":"Labour","amount":<int>}},{{"label":"Skill premium","amount":<int>}},{{"label":"Platform + shipping","amount":<int>}}],
  "market_note": "one sentence on market positioning"
}}
Make the breakdown amounts sum to roughly suggested_price. Prices realistic for India.
"""


def _extract_json(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```", 2)[1]
        if text.lstrip().startswith("json"):
            text = text.lstrip()[4:]
    start, end = text.find("{"), text.rfind("}")
    return json.loads(text[start : end + 1])


def generate_listing(transcript: str, language: str = "en", image_b64: str | None = None) -> dict:
    image_hint = (
        "A photo of the product is attached — use it to refine material, colour and category."
        if image_b64
        else "No photo provided; infer sensible details from the description."
    )
    # Always en/hi/kn, plus the artisan's own language when it's one of the
    # extra six — so the listing speaks their tongue too.
    langs = list(_ALWAYS)
    if language in _LANG_NAME and language not in langs:
        langs.append(language)
    title_shape = ", ".join(f'"{code}": "..."' for code in langs)
    lang_list = ", ".join(f"{_LANG_NAME[c]} ({c})" for c in langs)

    prompt = _LISTING_PROMPT.format(
        lang=_LANG_NAME.get(language, "the local language"),
        transcript=transcript,
        image_hint=image_hint,
        title_shape=title_shape,
        lang_list=lang_list,
    )
    parts: list = [prompt]
    if image_b64:
        try:
            parts.append({"mime_type": "image/png", "data": base64.b64decode(image_b64)})
        except Exception as e:
            log.warning("Could not decode image_b64, continuing text-only: %s", e)

    text = _generate(parts)
    if text is None:
        return mock_data.mock_listing(transcript, language)
    try:
        data = _extract_json(text)
        # keep the internal base-price hint out of the public API contract
        data.pop("_base_price", None)
        return data
    except Exception as e:
        log.warning("generate_listing could not parse model JSON, using mock: %s", e)
        return mock_data.mock_listing(transcript, language)


def estimate_price(payload: dict) -> dict:
    prompt = _PRICE_PROMPT.format(
        title=payload.get("title", ""),
        material=payload.get("material", ""),
        category=payload.get("category", ""),
        craft_technique=payload.get("craft_technique", ""),
        production_time=payload.get("production_time", "2 days"),
    )
    text = _generate([prompt])
    if text is None:
        return mock_data.mock_price(payload)
    try:
        return _extract_json(text)
    except Exception as e:
        log.warning("estimate_price could not parse model JSON, using mock: %s", e)
        return mock_data.mock_price(payload)
