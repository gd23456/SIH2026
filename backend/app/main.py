"""Karigar AI — FastAPI backend.

Endpoints:
  GET  /                     -> health + mode
  GET  /api/health           -> health + mode (mock vs live)
  POST /api/enhance-image    -> multipart image -> {original_b64, enhanced_b64, bg_removed}
  POST /api/generate-listing -> {transcript, language, image_b64?} -> multilingual Listing
  POST /api/price            -> product attrs -> fair price + reasoning
  POST /api/publish          -> listing+price -> ONDC catalog + share links (persisted)
  GET  /api/listings         -> the artisan's published products, newest first
  GET  /api/listings/{id}/image -> that listing's photo as a PNG
  GET  /p/{listing_id}       -> public storefront page (what the QR code opens)
  GET  /api/qr/{listing_id}  -> QR PNG pointing at that page
"""
from __future__ import annotations

import base64
import binascii
import io
import logging
from contextlib import asynccontextmanager
from pathlib import Path

import qrcode
from fastapi import Depends, FastAPI, File, HTTPException, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from sqlmodel import Session

from .config import get_settings
from .db import get_session, init_db
from .db import repository as repo
from .schemas import (
    GenerateListingRequest,
    ListingSummary,
    PriceRequest,
    PriceResponse,
    PublishRequest,
    PublishResponse,
)
from .services import (
    gemini_service,
    gi_service,
    image_service,
    ondc_service,
    pricing_service,
)

logging.basicConfig(level=logging.INFO)
settings = get_settings()

templates = Jinja2Templates(directory=str(Path(__file__).parent / "templates"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="Karigar AI",
    version="0.1.0",
    description="AI co-seller for artisans",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list + ["*"],  # permissive for hackathon/demo
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _mode() -> str:
    return "mock" if settings.use_mock else "live (Gemini)"


def _base_url(request: Request) -> str:
    """Public origin for storefront + QR links.

    Derived from the incoming request unless PUBLIC_BASE_URL is set. That is
    what makes the QR code work on demo day: the phone reaches the laptop at
    http://<LAN-IP>:8000, so links minted for it must say <LAN-IP> too — a
    hardcoded domain (or localhost) is a dead end on someone else's phone.
    """
    configured = settings.PUBLIC_BASE_URL.strip()
    if configured:
        return configured.rstrip("/")
    return str(request.base_url).rstrip("/")


@app.get("/")
def root():
    return {"app": "Karigar AI", "status": "ok", "mode": _mode()}


@app.get("/api/health")
def health():
    """Check this first when something looks wrong.

    `model` reports the model that actually answered — not just what's
    configured — so a bad model name shows up here instead of silently
    degrading the demo to mock.
    """
    return {
        "status": "ok",
        "mode": _mode(),
        "model": gemini_service.active_model(),
        "configured_model": settings.GEMINI_MODEL,
    }


@app.post("/api/enhance-image")
async def enhance_image(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "Please upload an image file.")
    raw = await file.read()
    if not raw:
        raise HTTPException(400, "Empty file.")
    try:
        return image_service.enhance_image(raw)
    except Exception as e:  # pragma: no cover
        logging.exception("enhance-image failed")
        raise HTTPException(500, f"Image processing failed: {e}") from e


@app.post("/api/generate-listing")
def generate_listing(req: GenerateListingRequest):
    listing = gemini_service.generate_listing(req.transcript, req.language, req.image_b64)
    # Verify against the real GI registry — a registry match is stronger than
    # the LLM's gi_candidate guess and earns the green "Verified GI" badge.
    gi = gi_service.verify(listing)
    listing["gi_verified"] = gi["matched"]
    listing["gi_registry_name"] = gi["name"] or None
    listing["gi_state"] = gi["state"] or None
    return listing


@app.post("/api/price", response_model=PriceResponse)
def price(req: PriceRequest):
    return pricing_service.fair_price(req.model_dump())


@app.post("/api/publish", response_model=PublishResponse)
def publish(
    req: PublishRequest,
    request: Request,
    session: Session = Depends(get_session),
):
    listing = req.listing.model_dump()
    # Re-verify server-side so a persisted "Verified GI" badge is always
    # authoritative, never just whatever the client claimed.
    gi = gi_service.verify(listing)
    listing["gi_verified"] = gi["matched"]
    listing["gi_registry_name"] = gi["name"] or None
    listing["gi_state"] = gi["state"] or None

    catalog = ondc_service.build_ondc_catalog(listing, req.price, req.artisan_name, req.location)
    listing_id = catalog.pop("_listing_id")

    repo.save_listing(
        session,
        listing_id=listing_id,
        listing=listing,
        price=req.price,
        image_b64=req.image_b64,
        artisan_name=req.artisan_name,
        location=req.location,
    )

    storefront = f"{_base_url(request)}/p/{listing_id}"
    title = listing.get("title", {}).get("en", "Handcrafted Product")
    return PublishResponse(
        listing_id=listing_id,
        status="PUBLISHED",
        ondc_catalog=catalog,
        whatsapp_share_url=ondc_service.whatsapp_share(title, req.price, storefront),
        storefront_url=storefront,
    )


def _summary(row, base: str) -> ListingSummary:
    return ListingSummary(
        listing_id=row.id,
        title={"en": row.title_en, "hi": row.title_hi, "kn": row.title_kn},
        price=row.price,
        category=row.category,
        gi_candidate=row.gi_candidate,
        gi_verified=row.gi_verified,
        gi_state=row.gi_state,
        has_image=bool(row.image_b64),
        image_url=f"{base}/api/listings/{row.id}/image",
        storefront_url=f"{base}/p/{row.id}",
        created_at=row.created_at,
    )


@app.get("/api/listings", response_model=list[ListingSummary])
def list_listings(
    request: Request,
    limit: int = 24,
    session: Session = Depends(get_session),
):
    """Everything this artisan has published, newest first.

    Backs the "My Products" screen, which is what turns the demo from a
    one-shot script into something that looks like a product.
    """
    limit = max(1, min(limit, 100))
    base = _base_url(request)
    return [_summary(row, base) for row in repo.recent_listings(session, limit=limit)]


@app.get("/api/search", response_model=list[ListingSummary])
def search(
    request: Request,
    q: str = "",
    limit: int = 24,
    session: Session = Depends(get_session),
):
    """Buyer-side search across the whole published catalog.

    This is the buyer half of the story: an artisan publishes, then anyone on
    the network can search and find that exact item. Same ListingSummary shape
    as /api/listings so the buyer grid renders identically.
    """
    limit = max(1, min(limit, 100))
    base = _base_url(request)
    return [_summary(row, base) for row in repo.search_listings(session, q, limit=limit)]


@app.get("/api/listings/{listing_id}/image")
def listing_image(listing_id: str, session: Session = Depends(get_session)):
    """The stored photo as a real PNG.

    Kept out of the /api/listings payload so a grid of thumbnails doesn't ship
    a megabyte of base64 over the demo hotspot.
    """
    row = repo.get_listing(session, listing_id)
    if row is None:
        raise HTTPException(404, "Listing not found")
    if not row.image_b64:
        raise HTTPException(404, "This listing has no image")
    try:
        raw = base64.b64decode(row.image_b64, validate=True)
    except (ValueError, binascii.Error) as e:
        raise HTTPException(500, "Stored image is not valid base64") from e
    return Response(content=raw, media_type="image/png",
                    headers={"Cache-Control": "public, max-age=300"})


_NOT_FOUND_PAGE = """<!doctype html><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Listing not found · Karigar AI</title>
<div style="font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;
            padding:0 1rem;text-align:center;color:#2B2320">
  <p style="font-size:2.5rem;margin:0">🧺</p>
  <h1 style="font-size:1.25rem">This listing isn't here</h1>
  <p style="color:#6E6259">It may have been published to a different device,
  or the database was reset since the QR code was printed.</p>
</div>"""


@app.get("/p/{listing_id}", response_class=HTMLResponse)
def storefront(listing_id: str, request: Request, session: Session = Depends(get_session)):
    """The page a judge lands on after scanning the QR code.

    Server-rendered rather than handed to the React app on purpose: it has to
    open on an unknown phone with no build step and no internet.
    """
    listing = repo.get_listing(session, listing_id)
    if listing is None:
        return HTMLResponse(_NOT_FOUND_PAGE, status_code=404)

    return templates.TemplateResponse(
        request=request,
        name="product.html",
        context={
            "listing": listing,
            "artisan": repo.get_artisan(session, listing.artisan_id),
            # Relative on purpose: the page is already being served from the
            # right origin, and an absolute URL would break if the page were
            # reached via a different host than the one that minted it.
            "qr_url": f"/api/qr/{listing_id}",
        },
    )


@app.get("/api/qr/{listing_id}")
def qr_png(listing_id: str, request: Request, session: Session = Depends(get_session)):
    """QR encoding the storefront URL for this listing."""
    if repo.get_listing(session, listing_id) is None:
        raise HTTPException(404, "Listing not found")

    img = qrcode.make(f"{_base_url(request)}/p/{listing_id}")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return Response(
        content=buf.getvalue(),
        media_type="image/png",
        # The same id can be served from a different host (laptop vs LAN IP),
        # and the encoded URL changes with it, so don't let a proxy pin it.
        headers={"Cache-Control": "no-store"},
    )
