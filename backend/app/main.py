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

import asyncio
import base64
import binascii
import io
import json
import logging
import os
import urllib.parse
from contextlib import asynccontextmanager
from pathlib import Path

import qrcode
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlmodel import Session

from .config import get_settings
from .db import get_session, init_db
from .db import repository as repo
from .db.models import ModelJob
from .schemas import (
    ArtisanOut,
    ArtisanUpsert,
    ChannelInfo,
    ChannelResult,
    GenerateListingRequest,
    ImpactOut,
    ListingSummary,
    ModelJobOut,
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
    model3d,
    ondc_service,
    pricing_service,
)
from .services.model3d import jobs as model_jobs

logging.basicConfig(level=logging.INFO)
settings = get_settings()

templates = Jinja2Templates(directory=str(Path(__file__).parent / "templates"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    # The 3D worker: resumes any queued/processing jobs left by a previous run.
    stop = asyncio.Event()
    task = None
    if os.environ.get("KARIGAR_DISABLE_MODEL_WORKER") != "1":
        task = asyncio.create_task(model_jobs.worker_loop(stop))
    yield
    stop.set()
    if task is not None:
        await task


app = FastAPI(
    title="Karigar AI",
    version="0.1.0",
    description="AI co-seller for artisans",
    lifespan=lifespan,
)

# Vendored, version-pinned assets for the storefront (model-viewer for 3D).
# Served from here rather than a CDN so a buyer's page works on a network
# with no internet route — the same rule as the rest of the storefront.
app.mount("/static", StaticFiles(directory=str(Path(__file__).parent / "static")), name="static")

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
        "integrations": {**integrations.status(), "model3d": model3d.provider_name()},
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
    # by_alias: LocalizedText stores Odia as `or_` because `or` is a Python
    # keyword. Without the alias the dump hands back {"or_": "..."} and every
    # downstream `title.get("or")` misses — Odia silently published empty while
    # the other eight languages went through, which is exactly the kind of bug
    # that only shows up if someone actually reads the app in Odia.
    listing = req.listing.model_dump(by_alias=True)
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

    # Link the product's 3D job — only with the token the creating device
    # holds, so a guessed job id can't graft someone else's model on.
    row = repo.get_listing(session, listing_id)
    edited = [f for f in req.edited_fields if f in _EDITABLE_FIELDS]
    if row is not None:
        row.edited_fields_json = json.dumps(sorted(set(edited)))
        if req.model_job_id and req.model_token and model_jobs.attach_to_listing(
            session, req.model_job_id, req.model_token, listing_id
        ):
            row.model_job_id = req.model_job_id
        session.add(row)
        session.commit()

    base = _base_url(request)
    storefront = f"{base}/p/{listing_id}"
    title = listing.get("title", {}).get("en", "Handcrafted Product")

    # ONDC is always present + de-duped, and is the one real channel: it gets a
    # live storefront + QR. Every other selected channel is recorded as an
    # honest, clearly-labelled demo publish.
    selected = list(dict.fromkeys(["ondc", *(req.channels or [])]))

    # Plan gating, enforced here rather than only in the UI. A client can send
    # any channel list it likes, so "Pro" has to mean something server-side or
    # it means nothing at all.
    #
    # What gets gated is deliberate: listing is ALWAYS free and always reaches
    # ONDC. We charge for extra distribution, never for the artisan's ability to
    # sell — charging someone to list their first product would kill the
    # adoption this whole thing depends on.
    artisan = repo.get_artisan_by_uid(session, req.artisan_uid) if req.artisan_uid else None
    is_pro = (artisan.plan if artisan else "free") == "pro"
    locked = [] if is_pro else [c for c in selected if c not in FREE_CHANNELS]
    selected = [c for c in selected if c not in locked]

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
        locked_channels=locked,
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


# Channels every artisan gets, on any plan, forever.
#
# ONDC is deliberately in here: it is the real one, the one with a live
# storefront and a QR a buyer can scan. Selling at all is free. Pro buys wider
# distribution — the extra marketplaces — not the right to exist.
FREE_CHANNELS = frozenset({"ondc"})




@app.get("/api/impact/{uid}", response_model=ImpactOut)
def impact(uid: str, session: Session = Depends(get_session)):
    """What the artisan actually gets: real reach counted from their listings.

    Deliberately only counters we can stand behind — products published,
    channels reached, storefront views, QR scans. There is no earnings figure:
    we do not observe sales, so any rupee number here would be a model's guess
    wearing the costume of a bank balance.
    """
    artisan = repo.get_artisan_by_uid(session, uid)
    data = repo.impact(session, artisan.id if artisan else None)
    return ImpactOut(**data)


@app.get("/api/channels", response_model=list[ChannelInfo])
def list_channels(uid: str = "", session: Session = Depends(get_session)):
    """The channel registry, annotated with this artisan's connection status.

    ONDC is always live-connected; the rest reflect whether the artisan has
    flipped the (simulated) connect toggle.
    """
    artisan = repo.get_artisan_by_uid(session, uid) if uid else None
    connected = repo.connected_channels(session, artisan.id if artisan else None)
    is_pro = (artisan.plan if artisan else "free") == "pro"
    out: list[ChannelInfo] = []
    for c in channels_service.all_channels():
        cid = c["id"]
        live_ready = c["kind"] == "live"  # ONDC is the only live channel
        out.append(ChannelInfo(
            id=cid, name=c["name"], kind=c["kind"], logo=c["logo"], note=c["note"],
            configured=live_ready,
            connected=live_ready or cid in connected,
            mode="live" if live_ready else "demo",
            # Mirrors the gate publish() enforces, so the UI shows a lock rather
            # than a checkbox the backend would silently ignore.
            requires_pro=not is_pro and cid not in FREE_CHANNELS,
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


_LANG_CODES = ("en", "hi", "kn", "ta", "te", "bn", "mr", "gu", "or")


def _model_info(session: Session, row, base: str) -> tuple[str | None, str | None]:
    if not getattr(row, "model_job_id", None):
        return None, None
    job = session.get(ModelJob, row.model_job_id)
    if job is None:
        return None, None
    url = f"{base}/api/models/{job.id}/model.glb" if job.status == "ready" and job.has_model else None
    return job.status, url


def _summary(row, base: str, session: Session | None = None) -> ListingSummary:
    status, url = _model_info(session, row, base) if session is not None else (None, None)
    return ListingSummary(
        model_status=status,
        model_url=url,
        listing_id=row.id,
        title={c: getattr(row, f"title_{c}", "") or "" for c in _LANG_CODES},
        description={c: getattr(row, f"description_{c}", "") or "" for c in _LANG_CODES},
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
    uid: str = "",
    session: Session = Depends(get_session),
):
    """Published listings, newest first.

    With `uid`, only that artisan's — which is what "My Products" needs, since
    it offers a delete button. Without it, the whole catalogue, which is what
    the home screen's recent strip wants. This used to ignore the artisan
    entirely and hand every caller everyone's listings, so "My Products" was
    quietly showing other people's work.
    """
    limit = max(1, min(limit, 100))
    base = _base_url(request)
    artisan = repo.get_artisan_by_uid(session, uid) if uid else None
    if uid and artisan is None:
        return []  # signed in, nothing published yet
    rows = repo.recent_listings(
        session, limit=limit, artisan_id=artisan.id if artisan else None
    )
    return [_summary(row, base, session) for row in rows]


@app.delete("/api/listings/{listing_id}", status_code=204)
def delete_listing(
    listing_id: str,
    uid: str = "",
    session: Session = Depends(get_session),
):
    """Remove one of your own listings.

    Ownership is enforced server-side against the signed-in uid. An artisan who
    publishes a bad photo could not previously undo it by any means short of
    raw SQL against the database.
    """
    if not uid:
        raise HTTPException(401, "Sign in to delete a listing")
    artisan = repo.get_artisan_by_uid(session, uid)
    if artisan is None:
        raise HTTPException(403, "Not your listing")
    existing = repo.get_listing(session, listing_id)
    job_id = existing.model_job_id if existing is not None and existing.artisan_id == artisan.id else None
    outcome = repo.delete_listing(session, listing_id, artisan.id)
    if outcome == "ok" and job_id:
        # The product is gone, so are its photos and model.
        job = session.get(ModelJob, job_id)
        if job is not None:
            session.delete(job)
            session.commit()
        model_jobs.delete_job_files(job_id)
    if outcome == "missing":
        raise HTTPException(404, "No such listing")
    if outcome == "forbidden":
        raise HTTPException(403, "Not your listing")
    return Response(status_code=204)


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
    return [_summary(row, base, session) for row in repo.search_listings(session, q, limit=limit)]


def _img_mime(raw: bytes) -> str:
    """Sniff PNG vs JPEG from magic bytes so we label stored photos correctly
    (seeded demo photos are JPEG; app-uploaded ones are PNG)."""
    if raw[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    return "image/png"


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
    return Response(content=raw, media_type=_img_mime(raw),
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

    img_mime = "image/png"
    if listing.image_b64:
        try:
            img_mime = _img_mime(base64.b64decode(listing.image_b64[:8]))  # 8 chars → 6 bytes
        except Exception:
            img_mime = "image/png"

    artisan = repo.get_artisan(session, listing.artisan_id)

    # 3D + the six capture views, when this product was captured that way.
    job = session.get(ModelJob, listing.model_job_id) if listing.model_job_id else None
    model_ready = bool(job and job.status == "ready" and job.has_model)
    views = [a for a in (job.views if job else []) if model_jobs.view_path(job.id, a).exists()]
    try:
        edited = set(json.loads(listing.edited_fields_json or "[]"))
    except ValueError:
        edited = set()

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
            "base_url": _base_url(request),
            "model_url": f"/api/models/{job.id}/model.glb" if model_ready else None,
            "model_is_test": bool(job and job.provider == "mock"),
            "view_urls": [(a, f"/api/models/{job.id}/views/{a}.jpg") for a in views] if job else [],
            "text_edited": bool(edited & {"title", "description"}),
            "image_mime": img_mime,
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


# --- 3D models -------------------------------------------------------------

_EDITABLE_FIELDS = {
    "title", "description", "material", "category", "craft_technique",
    "production_time", "dimensions", "tags",
}


def _job_out(job: ModelJob, base: str, token: str | None = None) -> ModelJobOut:
    return ModelJobOut(
        job_id=job.id,
        status=job.status,
        progress=job.progress,
        provider=job.provider,
        model_version=job.model_version,
        is_test_model=job.provider == "mock",
        error=job.error if job.status in ("failed", "unavailable", "expired") else "",
        views=job.views,
        model_url=f"{base}/api/models/{job.id}/model.glb" if job.status == "ready" and job.has_model else None,
        created_at=job.created_at,
        finished_at=job.finished_at,
        token=token,
    )


def _owned_job(session: Session, job_id: str, token: str | None) -> ModelJob:
    job = session.get(ModelJob, job_id) if job_id.isalnum() else None
    # Same 404 for "no such job" and "wrong token": don't confirm ids exist.
    if job is None or not model_jobs.token_ok(job, token):
        raise HTTPException(404, "No such 3D job")
    return job


@app.post("/api/models", response_model=ModelJobOut, status_code=201)
async def create_model_job(
    request: Request,
    front: UploadFile = File(...),
    right: UploadFile = File(...),
    back: UploadFile = File(...),
    left: UploadFile = File(...),
    top: UploadFile = File(...),
    bottom: UploadFile = File(...),
    uid: str = Form(""),
    client_id: str = Form(""),
    session: Session = Depends(get_session),
):
    """Six capture views in; a queued 3D job out.

    All six are required. Each is decoded, size-checked and re-encoded
    server-side (see jobs.normalise_view) — the Content-Type is not trusted.
    """
    files = {"front": front, "right": right, "back": back, "left": left, "top": top, "bottom": bottom}
    raw: dict[str, bytes] = {}
    for angle, f in files.items():
        data = await f.read(model_jobs.MAX_UPLOAD_BYTES + 1)
        if not data:
            raise HTTPException(400, f"{angle} photo is empty")
        raw[angle] = data
    try:
        job, token = model_jobs.create_job(
            session, views=raw, owner_uid=uid.strip() or None, client_id=client_id.strip()[:64]
        )
    except model_jobs.InvalidUpload as e:
        raise HTTPException(400, str(e)) from e
    return _job_out(job, _base_url(request), token)


@app.get("/api/models/{job_id}", response_model=ModelJobOut)
def get_model_job(
    job_id: str,
    request: Request,
    x_model_token: str | None = Header(default=None),
    session: Session = Depends(get_session),
):
    return _job_out(_owned_job(session, job_id, x_model_token), _base_url(request))


@app.post("/api/models/{job_id}/retry", response_model=ModelJobOut)
def retry_model_job(
    job_id: str,
    request: Request,
    x_model_token: str | None = Header(default=None),
    session: Session = Depends(get_session),
):
    job = model_jobs.retry(session, _owned_job(session, job_id, x_model_token))
    return _job_out(job, _base_url(request))


@app.get("/api/models/{job_id}/model.glb")
def model_glb(job_id: str, session: Session = Depends(get_session)):
    """The model file. Public by capability: the id is 128 random bits.

    Buyers load it from the storefront, so it can't sit behind the artisan's
    token; it is only ever linked from the owner's app and published pages.
    Immutable per job id, so phones and CDNs may cache it for good.
    """
    job = session.get(ModelJob, job_id) if job_id.isalnum() else None
    path = model_jobs.model_path(job_id) if job is not None else None
    if job is None or job.status != "ready" or path is None or not path.exists():
        raise HTTPException(404, "No model")
    return FileResponse(
        path,
        media_type="model/gltf-binary",
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )


@app.get("/api/models/{job_id}/views/{angle}.jpg")
def model_view(
    job_id: str,
    angle: str,
    token: str | None = None,
    x_model_token: str | None = Header(default=None),
    session: Session = Depends(get_session),
):
    """One capture view. Owner-only until the product is published."""
    if angle not in model3d.ANGLES:
        raise HTTPException(404, "No such view")
    job = session.get(ModelJob, job_id) if job_id.isalnum() else None
    if job is None:
        raise HTTPException(404, "No such view")
    published = job.listing_id is not None
    if not published and not model_jobs.token_ok(job, x_model_token or token):
        raise HTTPException(404, "No such view")
    path = model_jobs.view_path(job_id, angle)
    if not path.exists():
        raise HTTPException(404, "No such view")
    return FileResponse(
        path,
        media_type="image/jpeg",
        headers={"Cache-Control": "public, max-age=86400" if published else "private, no-store"},
    )


@app.post("/api/listings/{listing_id}/model", response_model=ModelJobOut)
def attach_model_later(
    listing_id: str,
    request: Request,
    job_id: str = Form(...),
    uid: str = Form(""),
    x_model_token: str | None = Header(default=None),
    session: Session = Depends(get_session),
):
    """Link a 3D job to an already-published listing.

    For products captured offline: the listing can go live (from the publish
    queue) before its six photos have uploaded. The device keeps the photos,
    uploads them when it can, and then attaches the job here. Needs both the
    listing's owner uid and the job's device token.
    """
    listing = repo.get_listing(session, listing_id)
    artisan = repo.get_artisan_by_uid(session, uid) if uid else None
    if listing is None or artisan is None or listing.artisan_id != artisan.id:
        raise HTTPException(404, "No such listing")
    job = _owned_job(session, job_id, x_model_token)
    job.listing_id = listing_id
    listing.model_job_id = job.id
    session.add(job)
    session.add(listing)
    session.commit()
    session.refresh(job)
    return _job_out(job, _base_url(request))
