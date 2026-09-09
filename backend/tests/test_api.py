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

from app import main
from app.config import Settings
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

# --- storefront, persistence + QR -----------------------------------------


def _publish(price: int = 749, **extra) -> dict:
    payload = {
        "listing": LISTING_FIXTURE,
        "price": price,
        "artisan_name": "Lakshmi Devi",
        "location": "Bengaluru",
        **extra,
    }
    r = client.post("/api/publish", json=payload)
    assert r.status_code == 200
    return r.json()


def test_storefront_url_is_derived_from_request_host():
    """The old hardcoded karigar.ai domain does not exist — the demo ended on
    a dead link. Links must point at whatever host the caller reached us on,
    because on demo day that is the laptop's LAN IP, not a domain."""
    body = _publish()
    assert "karigar.ai" not in body["storefront_url"]
    # TestClient presents itself as http://testserver
    assert body["storefront_url"] == f"http://testserver/p/{body['listing_id']}"
    assert body["listing_id"] in body["whatsapp_share_url"]


def test_public_base_url_overrides_request_host(monkeypatch):
    """Set PUBLIC_BASE_URL and a real deployment wins over the request host."""
    monkeypatch.setattr(main.settings, "PUBLIC_BASE_URL", "https://karigar.example/")
    body = _publish()
    assert body["storefront_url"] == f"https://karigar.example/p/{body['listing_id']}"


def test_published_listing_survives_and_renders():
    """A publish must outlive its own response: the judge scans the QR later."""
    body = _publish(price=1299)
    r = client.get(f"/p/{body['listing_id']}")

    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/html")
    page = r.text

    assert LISTING_FIXTURE["title"]["en"] in page
    assert LISTING_FIXTURE["title"]["hi"] in page       # all three languages
    assert LISTING_FIXTURE["title"]["kn"] in page
    assert "1,299" in page                               # price, formatted
    assert "Lakshmi Devi" in page
    assert "Natural Bamboo" in page
    assert body["listing_id"] in page

    # No external requests: the demo phone is on a hotspot with no internet.
    for scheme in ("http://", "https://"):
        assert f'src="{scheme}' not in page
        assert f'href="{scheme}' not in page


def test_storefront_page_embeds_its_own_qr():
    body = _publish()
    page = client.get(f"/p/{body['listing_id']}").text
    assert f"/api/qr/{body['listing_id']}" in page


def test_qr_endpoint_returns_a_png():
    body = _publish()
    r = client.get(f"/api/qr/{body['listing_id']}")
    assert r.status_code == 200
    assert r.headers["content-type"] == "image/png"
    png_magic = bytes.fromhex("89504e470d0a1a0a")
    assert r.content.startswith(png_magic)
    Image.open(io.BytesIO(r.content)).verify()


def test_unknown_listing_is_not_found():
    assert client.get("/p/KARIGAR-NOPE").status_code == 404
    assert client.get("/api/qr/KARIGAR-NOPE").status_code == 404


def test_unknown_listing_page_is_html_not_json():
    """A mis-scanned QR should not show a judge a raw JSON error blob."""
    r = client.get("/p/KARIGAR-NOPE")
    assert r.headers["content-type"].startswith("text/html")
    assert "{" not in r.text[:20]

# --- configuration ---------------------------------------------------------


def test_relative_sqlite_path_is_anchored_to_backend_dir():
    """A relative sqlite URL must not follow the working directory.

    `make backend` launches uvicorn from the repo root with --app-dir backend,
    so the shipped sqlite:///./karigar.db would land the database in the repo
    root, outside the backend/*.db gitignore rules.
    """
    resolved = Settings(DATABASE_URL="sqlite:///./karigar.db").database_url
    assert resolved.endswith("/backend/karigar.db"), resolved
    assert "/./" not in resolved


def test_absolute_sqlite_path_is_left_alone(tmp_path):
    target = (tmp_path / "explicit.db").resolve().as_posix()
    assert Settings(DATABASE_URL=f"sqlite:///{target}").database_url == f"sqlite:///{target}"


def test_non_sqlite_database_url_is_left_alone():
    url = "postgresql+psycopg://user:pw@db.example/karigar"
    assert Settings(DATABASE_URL=url).database_url == url

# --- my products (listing index) -------------------------------------------


def test_listings_returns_published_items_newest_first():
    a = _publish(price=111)["listing_id"]
    b = _publish(price=222)["listing_id"]

    rows = client.get("/api/listings").json()
    ids = [r["listing_id"] for r in rows]
    assert a in ids and b in ids
    assert ids.index(b) < ids.index(a), "newest listing must come first"

    row = next(r for r in rows if r["listing_id"] == b)
    assert row["price"] == 222
    assert {"en", "hi", "kn"} <= row["title"].keys()
    assert row["storefront_url"].endswith(f"/p/{b}")
    assert row["image_url"].endswith(f"/api/listings/{b}/image")


def test_listings_omit_the_image_blob():
    """A grid of thumbnails must not ship a megabyte of base64 to a phone."""
    _publish(image_b64=base64.b64encode(_png_bytes()).decode())
    rows = client.get("/api/listings").json()
    assert rows, "expected at least one listing"
    for row in rows:
        assert "image_b64" not in row


def test_listings_limit_is_clamped():
    assert len(client.get("/api/listings?limit=1").json()) == 1
    # out-of-range values must not blow up or return the whole table
    assert client.get("/api/listings?limit=0").status_code == 200
    assert client.get("/api/listings?limit=99999").status_code == 200


def test_listing_image_serves_a_png():
    body = _publish(image_b64=base64.b64encode(_png_bytes()).decode())
    r = client.get(f"/api/listings/{body['listing_id']}/image")
    assert r.status_code == 200
    assert r.headers["content-type"] == "image/png"
    Image.open(io.BytesIO(r.content)).verify()


def test_listing_image_404s_without_a_photo():
    body = _publish()  # fixture carries no image
    assert client.get(f"/api/listings/{body['listing_id']}/image").status_code == 404
    assert client.get("/api/listings/KARIGAR-NOPE/image").status_code == 404
