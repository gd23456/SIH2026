"""Karigar AI — API contract tests.

These run in MOCK mode (no GEMINI_API_KEY needed) and without rembg installed,
so they pass on any laptop and in CI. That is deliberate: the mock path is the
path we demo on if the venue wifi dies, so it is the path that must never break.
"""
from __future__ import annotations

import base64
import io
import re
from urllib.parse import quote

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


def test_health_reports_integrations():
    body = client.get("/api/health").json()
    integ = body["integrations"]
    assert integ["gemini"] in ("live", "mock")
    assert isinstance(integ["rembg"], bool)
    assert integ["firebase"] in ("configured", "off")


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


def test_enhance_image_removes_background_when_rembg_installed():
    """When rembg is available AND can run, a real photo comes back with
    bg_removed=True and a decodable studio image. Skipped where rembg isn't
    installed (CI/mock), or where the U^2-Net model can't allocate memory on a
    constrained machine — in which case the service correctly falls back."""
    pytest.importorskip("rembg")
    r = client.post(
        "/api/enhance-image",
        files={"file": ("basket.png", _png_bytes(), "image/png")},
    )
    assert r.status_code == 200
    body = r.json()
    # Always returns a valid, decodable studio image (cutout or fallback).
    Image.open(io.BytesIO(base64.b64decode(body["enhanced_b64"]))).verify()
    if not body["bg_removed"]:
        pytest.skip("rembg installed but couldn't run here (e.g. OOM) — fell back gracefully")
    assert body["bg_removed"] is True


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


@pytest.mark.parametrize("language", ["ta", "te", "bn", "mr", "gu", "or"])
def test_generate_listing_carries_the_chosen_language(language):
    """A listing generated in one of the six extra languages must carry that
    language populated, not silently fall back to raw English."""
    r = client.post(
        "/api/generate-listing",
        json={"transcript": "Handmade bamboo basket", "language": language},
    )
    assert r.status_code == 200
    listing = r.json()
    # en/hi/kn always present
    assert {"en", "hi", "kn"} <= listing["title"].keys()
    # the chosen language is present and not identical to English
    assert listing["title"].get(language, "").strip()
    assert listing["title"][language] != listing["title"]["en"]


def test_generate_listing_sets_source_header():
    """The client reads X-Karigar-Mode to show an honest AI/demo badge.
    In mock mode (tests) it must be 'mock', never 'live'."""
    r = client.post("/api/generate-listing", json={"transcript": "bamboo basket", "language": "en"})
    assert r.headers.get("X-Karigar-Mode") == "mock"


def test_price_sets_source_header():
    r = client.post("/api/price", json={"title": "Bamboo Basket", "material": "Bamboo", "production_time": "3 days"})
    assert r.headers.get("X-Karigar-Mode") == "mock"


def test_generate_listing_handles_unknown_craft():
    """An unmatched transcript must still produce a well-formed listing."""
    r = client.post(
        "/api/generate-listing",
        json={"transcript": "some craft we have never seen before", "language": "en"},
    )
    assert r.status_code == 200
    assert r.json()["title"]["en"]


def test_generate_listing_from_photo_only():
    """The 'snap a photo, AI drafts it' path: an image + empty transcript must
    still yield a well-formed, editable listing (mock returns a sensible default)."""
    img_b64 = base64.b64encode(_png_bytes()).decode()
    r = client.post(
        "/api/generate-listing",
        json={"transcript": "", "language": "en", "image_b64": img_b64},
    )
    assert r.status_code == 200
    listing = r.json()
    assert {"en", "hi", "kn"} <= listing["title"].keys()
    assert all(listing["title"][lang].strip() for lang in ("en", "hi", "kn"))
    assert listing["material"]
    assert isinstance(listing["tags"], list) and listing["tags"]


def test_generate_listing_omitting_transcript_is_allowed():
    """transcript is optional now (photo-only clients may omit it entirely)."""
    r = client.post("/api/generate-listing", json={"language": "en"})
    assert r.status_code == 200
    assert r.json()["title"]["en"]


# Script block each language must actually be written in. Marathi shares
# Devanagari with Hindi, which is correct - it is the same script.
_SCRIPTS = {
    "hi": (0x0900, 0x097F), "mr": (0x0900, 0x097F), "bn": (0x0980, 0x09FF),
    "gu": (0x0A80, 0x0AFF), "or": (0x0B00, 0x0B7F), "ta": (0x0B80, 0x0BFF),
    "te": (0x0C00, 0x0C7F), "kn": (0x0C80, 0x0CFF),
}


def _script_vs_latin(text: str, lo: int, hi: int) -> tuple[int, int]:
    """(chars in the target script, ASCII letters) - for "is this really Tamil?"."""
    target = sum(1 for ch in text if lo <= ord(ch) <= hi)
    latin = sum(1 for ch in text if ch.isascii() and ch.isalpha())
    return target, latin


@pytest.mark.parametrize("lang", sorted(_SCRIPTS))
@pytest.mark.parametrize(
    "transcript",
    [
        "handmade bamboo basket",
        "clay terracotta vase",
        "mysore silk saree",
        "channapatna wooden toy",
        "some craft we have never seen before",  # falls through to the default
    ],
)
def test_generate_listing_is_actually_translated(transcript, lang):
    """Every language must be real text in its own script, not English relabelled.

    Mock mode is the stage fallback, and "a listing in nine languages at once"
    is the claim being made while this screen is on the projector. A non-empty
    check is not enough: the previous implementation regex-swapped ~17 English
    words per language, which left every description byte-identical to English
    and still passed a non-empty assertion.
    """
    r = client.post(
        "/api/generate-listing",
        json={"transcript": transcript, "language": lang},
    )
    assert r.status_code == 200
    listing = r.json()
    lo, hi = _SCRIPTS[lang]

    for field in ("title", "description"):
        assert lang in listing[field], f"{field} missing {lang}"
        en = listing[field]["en"]
        got = listing[field][lang]

        assert got != en, f"{field}.{lang} is identical to English"

        # Not merely "contains one translated word" - the target script has to
        # outweigh the Latin text, or it is English with a few nouns swapped.
        script, latin = _script_vs_latin(got, lo, hi)
        assert script > latin, (
            f"{field}.{lang} is mostly Latin ({script} in-script vs {latin} ASCII)"
        )


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


# --- grounded fair-price engine -------------------------------------------


def _price(**payload) -> dict:
    r = client.post("/api/price", json=payload)
    assert r.status_code == 200
    return r.json()


def test_price_is_grounded_against_a_market_comparable():
    """A recognisable craft must surface an observed market band."""
    p = _price(
        title="Handwoven Bamboo Storage Basket",
        material="Natural Bamboo",
        category="Home & Living / Storage",
        craft_technique="Traditional hand-weaving",
        production_time="3 days",
    )
    assert p["market_median"] > 0, "bamboo storage should match a comparable"
    assert p["market_sample_count"] > 0
    assert p["market_source"]
    # the market note / reasoning must actually cite the comparable
    assert any("median" in r.lower() for r in p["reasoning"])


def test_price_never_falls_below_the_fair_wage_floor():
    """The social-impact guarantee: price ≥ labour_days × DAILY_FAIR_WAGE."""
    from app.services.pricing_service import DAILY_FAIR_WAGE

    # A long production time forces a high wage floor that must bind.
    p = _price(
        title="Simple cotton pouch",
        material="Cotton",
        category="Textiles",
        production_time="30 days",
    )
    expected_floor = 30 * DAILY_FAIR_WAGE
    assert p["wage_floor"] == expected_floor
    assert p["suggested_price"] >= p["wage_floor"]
    assert p["suggested_price"] >= expected_floor
    assert p["wage_floor_applied"] is True
    assert p["min_price"] >= p["wage_floor"]


def test_price_breakdown_sums_to_suggested_price():
    p = _price(
        title="Hand-thrown Terracotta Vase",
        material="Terracotta Clay",
        category="Home & Living / Decor",
        production_time="4 days",
    )
    assert sum(b["amount"] for b in p["breakdown"]) == p["suggested_price"]
    assert p["min_price"] <= p["suggested_price"] <= p["max_price"]


def test_price_reports_grounding_fields_even_without_a_match():
    """An unknown craft still gets the fair-wage floor and a default band."""
    p = _price(title="mysterious artefact", material="unknown", production_time="2 days")
    assert "wage_floor" in p and "wage_floor_applied" in p
    assert p["suggested_price"] >= p["wage_floor"]


# --- GI verification -------------------------------------------------------


def test_generate_listing_verifies_a_real_gi_craft():
    """A Channapatna craft must verify against the registry (not just guess)."""
    r = client.post(
        "/api/generate-listing",
        json={"transcript": "Channapatna wooden spinning top toy set", "language": "en"},
    )
    assert r.status_code == 200
    listing = r.json()
    assert listing["gi_verified"] is True
    assert "Channapatna" in listing["gi_registry_name"]
    assert listing["gi_state"] == "Karnataka"


def test_generate_listing_does_not_verify_a_generic_craft():
    """An unrecognised craft is not a GI and must not be verified."""
    r = client.post(
        "/api/generate-listing",
        json={"transcript": "some craft we have never seen before", "language": "en"},
    )
    assert r.status_code == 200
    listing = r.json()
    assert listing["gi_verified"] is False
    assert not listing["gi_registry_name"]


def test_verified_gi_applies_a_price_premium():
    """A verified GI is priced above a generic equivalent."""
    p = _price(
        title="Mysore Silk Saree",
        material="Pure Mulberry Silk with Gold Zari",
        category="Clothing / Ethnic Wear",
        craft_technique="Traditional handloom weaving",
        production_time="12 days",
    )
    assert p["gi_verified"] is True
    assert p["gi_premium_applied"] is True
    assert any("GI" in r for r in p["reasoning"])


def test_generic_craft_has_no_gi_premium():
    p = _price(
        title="Handwoven Bamboo Storage Basket",
        material="Natural Bamboo",
        category="Home & Living / Storage",
        production_time="3 days",
    )
    assert p["gi_verified"] is False
    assert p["gi_premium_applied"] is False


def test_verified_gi_persists_to_the_storefront():
    """The green Verified GI badge must survive publish and render on /p/{id}."""
    channapatna = {
        **LISTING_FIXTURE,
        "title": {"en": "Channapatna Wooden Toy Set", "hi": "चन्नापटना खिलौना", "kn": "ಚನ್ನಪಟ್ಟಣ ಆಟಿಕೆ"},
        "material": "Ivory-wood with lac colours",
        "craft_technique": "Lacquer-turnery (Channapatna)",
        "category": "Toys & Games",
        "gi_candidate": "Channapatna Toys (GI)",
    }
    body = client.post(
        "/api/publish",
        json={"listing": channapatna, "price": 897, "artisan_name": "Ravi", "location": "Channapatna"},
    ).json()

    page = client.get(f"/p/{body['listing_id']}").text
    assert "Verified GI" in page
    assert "Channapatna Toys and Dolls" in page
    assert "Karnataka" in page

    rows = client.get("/api/listings").json()
    row = next(r for r in rows if r["listing_id"] == body["listing_id"])
    assert row["gi_verified"] is True
    assert row["gi_state"] == "Karnataka"


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

    # No external requests while RENDERING: the demo phone is on a hotspot with
    # no internet, so nothing the page needs to paint may be fetched remotely.
    #
    # Anchor hrefs are deliberately exempt: an <a> is only followed when the
    # buyer taps it, so the "Order on WhatsApp" link costs nothing offline. We
    # check the tags that actually issue a request instead of every href.
    for scheme in ("http://", "https://"):
        assert f'src="{scheme}' not in page
    for tag in re.findall(r"<(?:link|script|img|iframe)\b[^>]*>", page, re.I):
        assert "http://" not in tag and "https://" not in tag, f"remote resource: {tag}"


def test_storefront_offers_a_way_to_actually_buy():
    """A published product a buyer can look at but not act on is a dead end.

    Until ONDC BPP registration there is no in-network checkout, so the page
    must at least hand the buyer to the maker with the product prefilled.
    """
    body = _publish()
    page = client.get(f"/p/{body['listing_id']}").text

    assert "wa.me" in page, "storefront must offer a way to order"
    # the order message has to carry what is being ordered, and from where
    assert "Order on WhatsApp" in page
    assert quote(LISTING_FIXTURE["title"]["en"]) in page or LISTING_FIXTURE["title"]["en"] in page
    assert quote(body["listing_id"]) in page or body["listing_id"] in page


def test_storefront_has_language_switcher_not_stacked_descriptions():
    """The storefront must offer a language switcher, not three stacked copies."""
    body = _publish()
    page = client.get(f"/p/{body['listing_id']}").text
    assert 'id="langtabs"' in page
    assert 'data-lang="hi"' in page and 'data-lang="kn"' in page
    # non-English title/description blocks start hidden (one shown at a time)
    assert "hidden" in page


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


# --- buyer-side search ------------------------------------------------------


def test_search_finds_a_published_item_by_title_word():
    """The buyer beat: publish, then find that exact item in a search."""
    body = _publish(price=749, image_b64=base64.b64encode(_png_bytes()).decode())
    rows = client.get("/api/search?q=bamboo").json()
    assert any(r["listing_id"] == body["listing_id"] for r in rows)
    for r in rows:
        assert r["storefront_url"].endswith(f"/p/{r['listing_id']}")
        assert "image_url" in r


def test_search_hides_listings_with_no_photo():
    """A buyer tile is mostly image — a photo-less row renders as a grey box."""
    no_photo = _publish(price=500)
    with_photo = _publish(price=500, image_b64=base64.b64encode(_png_bytes()).decode())
    ids = [r["listing_id"] for r in client.get("/api/search?q=bamboo").json()]
    assert with_photo["listing_id"] in ids
    assert no_photo["listing_id"] not in ids
    # ...but the artisan still sees it in their own catalogue, to fix or delete.
    mine = [r["listing_id"] for r in client.get("/api/listings").json()]
    assert no_photo["listing_id"] in mine


def test_search_matches_category_and_tags():
    _publish(price=749)
    assert client.get("/api/search?q=storage").json(), "should match category"
    assert client.get("/api/search?q=handmade").json(), "should match a tag"


def test_search_empty_query_returns_recent_catalog():
    _publish(price=749)
    rows = client.get("/api/search?q=").json()
    assert isinstance(rows, list) and rows


def test_search_miss_returns_empty_list():
    rows = client.get("/api/search?q=zzzznowaythisexists").json()
    assert rows == []


# --- accounts (Phase 3) ----------------------------------------------------


def test_artisan_upsert_and_fetch():
    r = client.post("/api/artisan", json={
        "uid": "uid-abc", "name": "Asha", "email": "asha@example.com",
        "phone": "+919999999999", "location": "Mysuru",
    })
    assert r.status_code == 200
    a = r.json()
    assert a["uid"] == "uid-abc" and a["name"] == "Asha" and a["plan"] == "free"

    # partial update must not blank other fields
    client.post("/api/artisan", json={"uid": "uid-abc", "location": "Bengaluru"})
    a2 = client.get("/api/artisan/uid-abc").json()
    assert a2["location"] == "Bengaluru"
    assert a2["name"] == "Asha"          # preserved
    assert a2["email"] == "asha@example.com"


def test_artisan_upgrade_to_pro():
    client.post("/api/artisan", json={"uid": "uid-pro", "name": "Ravi"})
    client.post("/api/artisan", json={"uid": "uid-pro", "plan": "pro"})
    assert client.get("/api/artisan/uid-pro").json()["plan"] == "pro"


def test_unknown_artisan_404s():
    assert client.get("/api/artisan/nobody").status_code == 404


# --- channels (Phase 3) ----------------------------------------------------


def test_channels_list_marks_ondc_live_and_others_demo():
    rows = client.get("/api/channels").json()
    by_id = {c["id"]: c for c in rows}
    assert by_id["ondc"]["kind"] == "live" and by_id["ondc"]["connected"] is True
    assert by_id["meesho"]["kind"] == "demo"
    # a fresh artisan has not connected the demo channels
    assert by_id["meesho"]["connected"] is False


def test_channel_connect_is_simulated_no_credentials():
    client.post("/api/artisan", json={"uid": "uid-ch", "name": "Devi"})
    r = client.post("/api/channels/meesho/connect", json={"uid": "uid-ch", "name": "Devi"})
    assert r.status_code == 200
    assert r.json() == {"connected": True, "mode": "demo", "channel_id": "meesho"}

    rows = client.get("/api/channels?uid=uid-ch").json()
    assert next(c for c in rows if c["id"] == "meesho")["connected"] is True


def test_connect_unknown_channel_404s():
    assert client.post("/api/channels/nope/connect", json={"uid": "x"}).status_code == 404


def test_publish_to_multiple_channels():
    """ONDC is really published (storefront URL); Meesho is a recorded demo.

    Uses a Pro artisan: extra channels are a paid feature, so a Free publish
    would legitimately drop Meesho. That gate has its own tests below.
    """
    client.post("/api/artisan", json={"uid": "multi-chan", "name": "Lakshmi"})
    client.post("/api/artisan", json={"uid": "multi-chan", "plan": "pro"})
    r = client.post("/api/publish", json={
        "listing": LISTING_FIXTURE, "price": 749,
        "artisan_name": "Lakshmi", "location": "Bengaluru",
        "artisan_uid": "multi-chan",
        "channels": ["ondc", "meesho"],
    })
    assert r.status_code == 200
    body = r.json()
    results = {c["channel_id"]: c for c in body["channel_results"]}

    assert results["ondc"]["kind"] == "live"
    assert results["ondc"]["storefront_url"].endswith(f"/p/{body['listing_id']}")
    assert results["meesho"]["kind"] == "demo"
    assert "demo" in results["meesho"]["status"].lower()
    assert results["meesho"]["ref"]                      # synthetic reference
    assert results["meesho"]["storefront_url"] is None   # nothing real behind it


def test_publish_always_includes_ondc_even_if_omitted():
    body = client.post("/api/publish", json={
        "listing": LISTING_FIXTURE, "price": 749, "channels": ["meesho"],
    }).json()
    ids = [c["channel_id"] for c in body["channel_results"]]
    assert "ondc" in ids


def test_publish_attaches_signed_in_artisan():
    client.post("/api/publish", json={
        "listing": LISTING_FIXTURE, "price": 749,
        "artisan_name": "Meera", "location": "Jaipur",
        "artisan_uid": "uid-publisher", "artisan_email": "meera@example.com",
        "channels": ["ondc"],
    })
    a = client.get("/api/artisan/uid-publisher").json()
    assert a["name"] == "Meera"
    assert a["listing_count"] >= 1


def test_listing_image_404s_without_a_photo():
    body = _publish()  # fixture carries no image
    assert client.get(f"/api/listings/{body['listing_id']}/image").status_code == 404
    assert client.get("/api/listings/KARIGAR-NOPE/image").status_code == 404


# --- impact dashboard (Phase 3) --------------------------------------------


def test_storefront_view_increments_the_counter():
    body = _publish(price=1000, artisan_name="Uma", location="Pune",
                    artisan_uid="uid-impact-1")
    before = client.get("/api/impact/uid-impact-1").json()["total_views"]
    client.get(f"/p/{body['listing_id']}")
    client.get(f"/p/{body['listing_id']}")
    after = client.get("/api/impact/uid-impact-1").json()["total_views"]
    assert after == before + 2


def test_impact_counts_products_and_reach():
    uid = "uid-impact-2"
    # Pro, so the second channel is genuinely reached and there is something to
    # aggregate — otherwise this silently becomes a test of the plan gate.
    client.post("/api/artisan", json={"uid": uid, "name": "Nadia"})
    client.post("/api/artisan", json={"uid": uid, "plan": "pro"})
    client.post("/api/publish", json={
        "listing": LISTING_FIXTURE, "price": 1000, "artisan_uid": uid,
        "artisan_name": "Nadia", "location": "Kutch", "channels": ["ondc", "meesho"],
    })
    client.post("/api/publish", json={
        "listing": LISTING_FIXTURE, "price": 2000, "artisan_uid": uid,
        "artisan_name": "Nadia", "location": "Kutch", "channels": ["ondc"],
    })
    imp = client.get(f"/api/impact/{uid}").json()
    assert imp["products"] == 2
    assert imp["channels_reached"] == 2      # ondc + meesho across the two
    # No earnings figure: we never observe a sale, so we never claim one.
    assert "fair_value_uplift" not in imp


def test_impact_unknown_artisan_is_zeroed_not_error():
    imp = client.get("/api/impact/nobody-here").json()
    assert imp == {
        "products": 0, "channels_reached": 0, "total_views": 0,
        "total_scans": 0, "currency": "INR",
    }


# --- plan gating -----------------------------------------------------------


def test_free_plan_publishes_to_ondc_only():
    """Free must still publish — listing is never gated, only extra reach is.

    The gate lives in the endpoint, not the UI: a client can send any channel
    list it likes, so "Pro" has to mean something server-side.
    """
    client.post("/api/artisan", json={"uid": "freeuser", "name": "Free Artisan"})
    r = client.post(
        "/api/publish",
        json={
            "listing": LISTING_FIXTURE,
            "price": 749,
            "artisan_uid": "freeuser",
            "channels": ["ondc", "meesho", "myntra", "whatsapp"],
        },
    )
    assert r.status_code == 200
    body = r.json()

    published = [c["channel_id"] for c in body["channel_results"]]
    assert published == ["ondc"], "free plan must still reach ONDC"
    assert set(body["locked_channels"]) == {"meesho", "myntra", "whatsapp"}
    # the publish itself succeeded — a locked channel is not a failure
    assert body["status"] == "PUBLISHED"
    assert body["storefront_url"]


def test_pro_plan_unlocks_every_channel():
    client.post("/api/artisan", json={"uid": "prouser", "name": "Pro Artisan"})
    client.post("/api/artisan", json={"uid": "prouser", "plan": "pro"})
    r = client.post(
        "/api/publish",
        json={
            "listing": LISTING_FIXTURE,
            "price": 749,
            "artisan_uid": "prouser",
            "channels": ["ondc", "meesho", "myntra", "whatsapp"],
        },
    )
    assert r.status_code == 200
    body = r.json()
    published = {c["channel_id"] for c in body["channel_results"]}
    assert published == {"ondc", "meesho", "myntra", "whatsapp"}
    assert body["locked_channels"] == []


def test_channels_endpoint_marks_pro_only_for_free_users():
    """The picker needs to show a lock, not a checkbox publish() would ignore."""
    client.post("/api/artisan", json={"uid": "freeuser2", "name": "Free Two"})
    rows = client.get("/api/channels", params={"uid": "freeuser2"}).json()
    by_id = {c["id"]: c for c in rows}
    assert by_id["ondc"]["requires_pro"] is False, "ONDC is free forever"
    assert by_id["meesho"]["requires_pro"] is True

    client.post("/api/artisan", json={"uid": "freeuser2", "plan": "pro"})
    rows = client.get("/api/channels", params={"uid": "freeuser2"}).json()
    assert all(c["requires_pro"] is False for c in rows)


# --- delete a listing ------------------------------------------------------


def _publish_one(uid: str, name: str = "Meera", price: int = 900) -> str:
    r = client.post("/api/publish", json={
        "listing": LISTING_FIXTURE, "price": price, "artisan_uid": uid,
        "artisan_name": name, "location": "Kutch", "channels": ["ondc"],
    })
    assert r.status_code == 200
    return r.json()["listing_id"]


def test_delete_removes_listing_and_its_publish_records():
    uid = "uid-del-1"
    client.post("/api/artisan", json={"uid": uid, "name": "Meera"})
    listing_id = _publish_one(uid)

    assert client.delete(f"/api/listings/{listing_id}?uid={uid}").status_code == 204
    assert client.get(f"/p/{listing_id}").status_code == 404
    # channels_reached must not keep counting a listing that is gone
    assert client.get(f"/api/impact/{uid}").json() == {
        "products": 0, "channels_reached": 0, "total_views": 0,
        "total_scans": 0, "currency": "INR",
    }


def test_delete_rejects_someone_elses_listing():
    owner, thief = "uid-del-owner", "uid-del-thief"
    client.post("/api/artisan", json={"uid": owner, "name": "Meera"})
    client.post("/api/artisan", json={"uid": thief, "name": "Nadia"})
    listing_id = _publish_one(owner)

    assert client.delete(f"/api/listings/{listing_id}?uid={thief}").status_code == 403
    # and it is still there
    assert client.get(f"/p/{listing_id}").status_code == 200


def test_delete_without_uid_is_unauthorised():
    uid = "uid-del-2"
    client.post("/api/artisan", json={"uid": uid, "name": "Meera"})
    listing_id = _publish_one(uid)
    assert client.delete(f"/api/listings/{listing_id}").status_code == 401
    assert client.get(f"/p/{listing_id}").status_code == 200


def test_delete_unknown_listing_is_404_not_500():
    uid = "uid-del-3"
    client.post("/api/artisan", json={"uid": uid, "name": "Meera"})
    _publish_one(uid)  # so the artisan exists with something published
    assert client.delete(f"/api/listings/does-not-exist?uid={uid}").status_code == 404


def test_my_products_is_scoped_to_the_signed_in_artisan():
    mine, theirs = "uid-scope-mine", "uid-scope-theirs"
    client.post("/api/artisan", json={"uid": mine, "name": "Meera"})
    client.post("/api/artisan", json={"uid": theirs, "name": "Nadia"})
    my_id = _publish_one(mine)
    their_id = _publish_one(theirs)

    ids = [r["listing_id"] for r in client.get(f"/api/listings?uid={mine}").json()]
    assert my_id in ids
    assert their_id not in ids  # "My Products" must never show someone else's

    # No uid: the whole catalogue, which is what the home strip wants.
    all_ids = [r["listing_id"] for r in client.get("/api/listings").json()]
    assert my_id in all_ids and their_id in all_ids


def test_publish_persists_all_nine_languages_including_odia():
    """Odia is aliased (`or` is a Python keyword) and so is easy to drop.

    model_dump() without by_alias yields {"or_": ...}, which every
    title.get("or") downstream misses — Odia published empty while the other
    eight went through, visible only to someone reading the app in Odia.
    """
    langs = ("en", "hi", "kn", "ta", "te", "bn", "mr", "gu", "or")
    listing = {
        **LISTING_FIXTURE,
        "title": {c: f"title-{c}" for c in langs},
        "description": {c: f"desc-{c}" for c in langs},
    }
    uid = "uid-nine-langs"
    client.post("/api/artisan", json={"uid": uid, "name": "Meera"})
    body = client.post("/api/publish", json={
        "listing": listing, "price": 900, "artisan_uid": uid,
        "artisan_name": "Meera", "location": "Kutch", "channels": ["ondc"],
        "image_b64": base64.b64encode(_png_bytes()).decode(),
    }).json()

    row = next(r for r in client.get(f"/api/listings?uid={uid}").json()
               if r["listing_id"] == body["listing_id"])
    for code in langs:
        assert row["title"][code] == f"title-{code}", f"title.{code} lost"
        assert row["description"][code] == f"desc-{code}", f"description.{code} lost"
