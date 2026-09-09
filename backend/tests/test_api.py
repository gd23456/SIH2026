"""Karigar AI — API contract tests.

These run in MOCK mode (no GEMINI_API_KEY needed) and without rembg installed,
so they pass on any laptop and in CI. That is deliberate: the mock path is the
path we demo on if the venue wifi dies, so it is the path that must never break.
"""
from __future__ import annotations

import base64
import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.main import app

client = TestClient(app)


def _png_bytes(size=(320, 240), colour=(120, 90, 60)) -> bytes:
    """A tiny in-memory JPEG-ish product photo stand-in."""
    buf = io.BytesIO()
    Image.new("RGB", size, colour).save(buf, format="PNG")
    return buf.getvalue()


# --- health ---------------------------------------------------------------


def test_root_reports_mode():
    r = client.get("/")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_health_reports_mode_and_model():
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert "mode" in body and "model" in body


# --- image enhancement ----------------------------------------------------


def test_enhance_image_returns_before_and_after():
    r = client.post(
        "/api/enhance-image",
        files={"file": ("basket.png", _png_bytes(), "image/png")},
    )
    assert r.status_code == 200
    body = r.json()
    assert {"original_b64", "enhanced_b64", "bg_removed"} <= body.keys()
    # both images must be decodable, non-empty base64
    for key in ("original_b64", "enhanced_b64"):
        raw = base64.b64decode(body[key])
        assert len(raw) > 100
        Image.open(io.BytesIO(raw)).verify()


def test_enhance_image_rejects_non_image():
    r = client.post("/api/enhance-image", files={"file": ("notes.txt", b"hello", "text/plain")})
    assert r.status_code == 400


def test_enhance_image_rejects_empty_file():
    r = client.post("/api/enhance-image", files={"file": ("empty.png", b"", "image/png")})
    assert r.status_code == 400


# --- listing generation ---------------------------------------------------


@pytest.mark.parametrize(
    "transcript,expect_keyword",
    [
        ("Handmade bamboo basket, takes three days to make", "bamboo"),
        ("This is a clay terracotta vase", "terracotta"),
    ],
)
def test_generate_listing_is_keyword_aware(transcript, expect_keyword):
    r = client.post(
        "/api/generate-listing",
        json={"transcript": transcript, "language": "en"},
    )
    assert r.status_code == 200
    listing = r.json()

    # multilingual title + description are the core promise of the product
    for field in ("title", "description"):
        assert {"en", "hi", "kn"} <= listing[field].keys()
        assert all(listing[field][lang].strip() for lang in ("en", "hi", "kn"))

    assert listing["material"]
    assert isinstance(listing["tags"], list) and listing["tags"]
    blob = (listing["title"]["en"] + listing["material"]).lower()
    assert expect_keyword in blob


def test_generate_listing_handles_unknown_craft():
    """An unmatched transcript must still produce a well-formed listing."""
    r = client.post(
        "/api/generate-listing",
        json={"transcript": "some craft we have never seen before", "language": "en"},
    )
    assert r.status_code == 200
    assert r.json()["title"]["en"]


# --- fair price -----------------------------------------------------------


def test_price_returns_sane_numbers_and_reasoning():
    r = client.post(
        "/api/price",
        json={
            "title": "Handwoven Bamboo Storage Basket",
            "material": "Natural Bamboo",
            "category": "Home & Living / Storage",
            "craft_technique": "Traditional hand-weaving",
            "production_time": "3 days",
        },
    )
    assert r.status_code == 200
    p = r.json()

    assert p["currency"] == "INR"
    assert isinstance(p["suggested_price"], int)
    assert p["suggested_price"] > 0
    assert p["min_price"] <= p["suggested_price"] <= p["max_price"]

    # the "explain the price" promise — judges will ask about this
    assert p["reasoning"], "price must always come with reasoning"
    assert p["breakdown"], "price must always come with a breakdown"
    for row in p["breakdown"]:
        assert {"label", "amount"} <= row.keys()


# --- publish --------------------------------------------------------------


LISTING_FIXTURE = {
    "title": {"en": "Handwoven Bamboo Storage Basket", "hi": "बाँस की टोकरी", "kn": "ಬಿದಿರು ಬುಟ್ಟಿ"},
    "description": {"en": "A lovely basket.", "hi": "सुंदर टोकरी।", "kn": "ಸುಂದರ ಬುಟ್ಟಿ."},
    "material": "Natural Bamboo",
    "category": "Home & Living / Storage",
    "craft_technique": "Traditional hand-weaving",
    "production_time": "3 days",
    "dimensions": "30 x 30 x 25 cm",
    "tags": ["handmade", "bamboo"],
    "gi_candidate": None,
}


def test_publish_builds_valid_ondc_catalog():
    r = client.post(
        "/api/publish",
        json={
            "listing": LISTING_FIXTURE,
            "price": 749,
            "artisan_name": "Lakshmi Devi",
            "location": "Bengaluru",
        },
    )
    assert r.status_code == 200
    body = r.json()

    assert body["status"] == "PUBLISHED"
    assert body["listing_id"].startswith("KARIGAR-")
    assert body["whatsapp_share_url"].startswith("https://wa.me/")
    assert body["storefront_url"]

    # ONDC shape — this is what makes the payload credible to ONDC judges
    ctx = body["ondc_catalog"]["context"]
    assert ctx["domain"] == "ONDC:RET10"
    assert ctx["country"] == "IND"

    providers = body["ondc_catalog"]["message"]["catalog"]["bpp/providers"]
    assert len(providers) == 1
    item = providers[0]["items"][0]
    assert item["price"]["value"] == "749"
    assert item["price"]["currency"] == "INR"
    assert item["descriptor"]["name"] == LISTING_FIXTURE["title"]["en"]


def test_publish_ids_are_unique():
    payload = {"listing": LISTING_FIXTURE, "price": 749}
    ids = {client.post("/api/publish", json=payload).json()["listing_id"] for _ in range(5)}
    assert len(ids) == 5, "each publish must mint a distinct listing id"
