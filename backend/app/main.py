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
import urllib.parse
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
    ArtisanOut,
    ArtisanUpsert,
    ChannelInfo,
    ChannelResult,
    GenerateListingRequest,
    ImpactOut,
    ListingSummary,
    PriceRequest,
    PriceResponse,
    PublishRequest,
    PublishResponse,
)
from .services import (
    channels as channels_service,
)
from .services import (
    gemini_service,
    gi_service,
    image_service,
    integrations,
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
    # So the browser can read whether Gemini or the mock produced the response.
    expose_headers=["X-Karigar-Mode"],
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
        # One glance at what's actually wired: gemini live|mock, rembg bool,
        # firebase configured|off.
        "integrations": integrations.status(),
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
def generate_listing(req: GenerateListingRequest, response: Response):
    listing = gemini_service.generate_listing(req.transcript, req.language, req.image_b64)
    # Verify against the real GI registry — a registry match is stronger than
    # the LLM's gi_candidate guess and earns the green "Verified GI" badge.
    gi = gi_service.verify(listing)
    listing["gi_verified"] = gi["matched"]
    listing["gi_registry_name"] = gi["name"] or None
    listing["gi_state"] = gi["state"] or None
    # Tell the client whether real Gemini answered, so the "● AI" badge is honest.
    response.headers["X-Karigar-Mode"] = gemini_service.last_source()
    return listing


@app.post("/api/price", response_model=PriceResponse)
def price(req: PriceRequest, response: Response):
    result = pricing_service.fair_price(req.model_dump())
    response.headers["X-Karigar-Mode"] = gemini_service.last_source()
    return result


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
        artisan_uid=req.artisan_uid,
        artisan_email=req.artisan_email,
        artisan_photo_url=req.artisan_photo_url,
    )

    base = _base_url(request)
    storefront = f"{base}/p/{listing_id}"
    title = listing.get("title", {}).get("en", "Handcrafted Product")

    # ONDC is always present + de-duped, and is the one real channel: it gets a
    # live storefront + QR. Every other selected channel is recorded as an
    # honest, clearly-labelled demo publish.
    selected = list(dict.fromkeys(["ondc", *(req.channels or [])]))
    results: list[ChannelResult] = []
    for cid in selected:
        ch = channels_service.get_channel(cid)
        if ch is None:
            continue

        if cid == "ondc":
            repo.record_channel_publish(
                session, listing_id=listing_id, channel_id=cid,
                status="Live on ONDC", mode="live", channel_ref=listing_id,
            )
            results.append(ChannelResult(
                channel_id=cid, name=ch["name"], kind="live", mode="live",
                status="Live on ONDC", ref=listing_id,
                storefront_url=storefront, qr_url=f"{base}/api/qr/{listing_id}",
            ))
        else:
            ref = channels_service.synthetic_ref(cid)
            repo.record_channel_publish(
                session, listing_id=listing_id, channel_id=cid,
                status=channels_service.demo_status(cid), mode="demo", channel_ref=ref,
            )
            results.append(ChannelResult(
                channel_id=cid, name=ch["name"], kind="demo", mode="demo",
                status=channels_service.demo_status(cid), ref=ref,
            ))

    return PublishResponse(
        listing_id=listing_id,
        status="PUBLISHED",
        ondc_catalog=catalog,
        whatsapp_share_url=ondc_service.whatsapp_share(title, req.price, storefront),
        storefront_url=storefront,
        channel_results=results,
    )


@app.post("/api/artisan", response_model=ArtisanOut)
def upsert_artisan(req: ArtisanUpsert, session: Session = Depends(get_session)):
    """Create or update the signed-in artisan's account (keyed by uid)."""
    artisan = repo.upsert_artisan(
        session, uid=req.uid, name=req.name, email=req.email, phone=req.phone,
        photo_url=req.photo_url, location=req.location, plan=req.plan,
    )
    return _artisan_out(session, artisan)


@app.get("/api/artisan/{uid}", response_model=ArtisanOut)
def get_artisan_by_uid(uid: str, session: Session = Depends(get_session)):
    artisan = repo.get_artisan_by_uid(session, uid)
    if artisan is None:
        raise HTTPException(404, "No such artisan")
    return _artisan_out(session, artisan)


_BASELINE_METHOD = (
    "Estimated additional income vs typical underpricing — each product's fair "
    "price minus a conservative baseline of 70% of it (a modest 30% underpricing "
    "gap), summed across the artisan's listings. Based on our fair-price engine; "
    "not audited sales data."
)


@app.get("/api/impact/{uid}", response_model=ImpactOut)
def impact(uid: str, session: Session = Depends(get_session)):
    """What the artisan actually gets: reach + estimated fair-value uplift."""
    artisan = repo.get_artisan_by_uid(session, uid)
    data = repo.impact(session, artisan.id if artisan else None)
    return ImpactOut(**data, baseline_method=_BASELINE_METHOD)


@app.get("/api/channels", response_model=list[ChannelInfo])
def list_channels(uid: str = "", session: Session = Depends(get_session)):
    """The channel registry, annotated with this artisan's connection status.

    ONDC is always live-connected; the rest reflect whether the artisan has
    flipped the (simulated) connect toggle.
    """
    artisan = repo.get_artisan_by_uid(session, uid) if uid else None
    connected = repo.connected_channels(session, artisan.id if artisan else None)
    out: list[ChannelInfo] = []
    for c in channels_service.all_channels():
        cid = c["id"]
        live_ready = c["kind"] == "live"  # ONDC is the only live channel
        out.append(ChannelInfo(
            id=cid, name=c["name"], kind=c["kind"], logo=c["logo"], note=c["note"],
            configured=live_ready,
            connected=live_ready or cid in connected,
            mode="live" if live_ready else "demo",
        ))
    return out


@app.post("/api/channels/{channel_id}/connect")
def connect_channel(channel_id: str, req: ArtisanUpsert, session: Session = Depends(get_session)):
    """Simulated connect — flips a status flag. NO credentials are collected."""
    ch = channels_service.get_channel(channel_id)
    if ch is None:
        raise HTTPException(404, "Unknown channel")
    artisan = repo.upsert_artisan(session, uid=req.uid, name=req.name)
    mode = "live" if ch["kind"] == "live" else "demo"
    repo.set_channel_connection(
        session, artisan_id=artisan.id, channel_id=channel_id, connected=True, mode=mode,
    )
    return {"connected": True, "mode": mode, "channel_id": channel_id}


def _artisan_out(session: Session, artisan) -> ArtisanOut:
    return ArtisanOut(
        id=artisan.id, uid=artisan.uid, name=artisan.name, email=artisan.email,
        phone=artisan.phone, photo_url=artisan.photo_url, location=artisan.location,
        plan=artisan.plan or "free",
        listing_count=repo.listing_count(session, artisan.id),
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

    repo.bump_counter(session, listing_id, "views")  # impact: storefront opened

    artisan = repo.get_artisan(session, listing.artisan_id)

    # The page had no way to actually buy anything. Until we are a registered
    # ONDC BPP there is no in-network checkout, so we hand the buyer to the
    # maker on WhatsApp rather than show a dead "Buy" button — addressed to the
    # artisan's number when we have one, otherwise an open share.
    order_text = (
        f'Hi! I\'d like to order "{listing.title_en}" '
        f"(₹{listing.price:,}) that I found on Karigar AI:\n"
        f"{_base_url(request)}/p/{listing_id}"
    )
    phone = "".join(c for c in (artisan.phone or "") if c.isdigit()) if artisan else ""

    return templates.TemplateResponse(
        request=request,
        name="product.html",
        context={
            "listing": listing,
            "artisan": artisan,
            # Relative on purpose: the page is already being served from the
            # right origin, and an absolute URL would break if the page were
            # reached via a different host than the one that minted it.
            "qr_url": f"/api/qr/{listing_id}",
            "wa_order_url": (
                f"https://wa.me/{phone}?text={urllib.parse.quote(order_text)}"
                if phone
                else f"https://wa.me/?text={urllib.parse.quote(order_text)}"
            ),
        },
    )


@app.get("/api/qr/{listing_id}")
def qr_png(listing_id: str, request: Request, session: Session = Depends(get_session)):
    """QR encoding the storefront URL for this listing."""
    if repo.get_listing(session, listing_id) is None:
        raise HTTPException(404, "Listing not found")

    # NOTE: we deliberately do NOT count QR fetches as "scans" — the storefront
    # page embeds this image, so it would just mirror page views. A real scan
    # opens /p/{id}, which is already counted as a view (the honest reach metric).
    img = qrcode.make(f"{_base_url(request)}/p/{listing_id}")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    # The same id can be served from a different host (laptop vs LAN IP), and
    # the encoded URL changes with it, so don't let a proxy pin it.
    return Response(content=buf.getvalue(), media_type="image/png",
                    headers={"Cache-Control": "no-store"})
