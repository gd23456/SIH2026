"""ModelJob lifecycle: validated intake, the worker loop, retry, retention.

State lives in the database, not in memory, so the worker picks up exactly
where it left off after a restart or deploy: queued jobs get submitted,
processing jobs get polled again with their stored provider task id.
"""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import io
import json
import logging
import secrets
import shutil
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError
from sqlmodel import Session, select

from ...config import get_settings
from ...db.models import ModelJob
from ...db.session import get_engine
from . import get_provider, provider_name
from .base import ANGLES, ProviderError

log = logging.getLogger("karigar.model3d")

MAX_UPLOAD_BYTES = 12 * 1024 * 1024  # per view, before re-encoding
MIN_SIDE = 256
MAX_SIDE = 1600  # stored + sent to the provider; plenty for reconstruction
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP", "HEIF", "MPO"}
MAX_SUBMIT_ATTEMPTS = 4


class InvalidUpload(ValueError):
    pass


# --------------------------------------------------------------- storage ---


def _root() -> Path:
    return get_settings().media_path / "models"


def job_dir(job_id: str) -> Path:
    # job ids are uuid hex — never a path fragment from the client
    if not job_id.isalnum():
        raise ValueError("bad job id")
    return _root() / job_id


def view_path(job_id: str, angle: str) -> Path:
    return job_dir(job_id) / "views" / f"{angle}.jpg"


def model_path(job_id: str) -> Path:
    return job_dir(job_id) / "model.glb"


# ------------------------------------------------------------------ tokens ---


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def token_ok(job: ModelJob, token: str | None) -> bool:
    return bool(token) and hmac.compare_digest(job.token_hash, _hash(token))


# ------------------------------------------------------------------ intake ---


def normalise_view(raw: bytes) -> bytes:
    """Validate one uploaded view and re-encode it as a clean JPEG.

    Decoding with Pillow (not trusting the Content-Type) rejects anything that
    isn't really an image; re-encoding strips EXIF — GPS included — and any
    payload smuggled in metadata; downscaling bounds storage and provider cost.
    """
    if len(raw) > MAX_UPLOAD_BYTES:
        raise InvalidUpload("image too large")
    try:
        im = Image.open(io.BytesIO(raw))
        fmt = (im.format or "").upper()
        im.load()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as e:
        raise InvalidUpload("not an image") from e
    if fmt not in ALLOWED_FORMATS:
        raise InvalidUpload(f"unsupported image type {fmt or '?'}")
    im = ImageOps.exif_transpose(im).convert("RGB")
    if min(im.size) < MIN_SIDE:
        raise InvalidUpload("image too small")
    im.thumbnail((MAX_SIDE, MAX_SIDE))
    out = io.BytesIO()
    im.save(out, format="JPEG", quality=88, optimize=True)
    return out.getvalue()


def create_job(session: Session, *, views: dict[str, bytes], owner_uid: str | None,
               client_id: str) -> tuple[ModelJob, str | None]:
    """Store the six views and queue a job.

    Returns (job, token). Idempotent on (owner_uid, client_id): a device that
    retries an upload it can't confirm gets the SAME job back — with token
    None, because the token was only ever shown once. The device keeps its
    original token, so it can still see the job.
    """
    if client_id:
        existing = session.exec(
            select(ModelJob).where(ModelJob.client_id == client_id, ModelJob.owner_uid == owner_uid)
        ).first()
        if existing is not None:
            return existing, None

    missing = [a for a in ANGLES if a not in views]
    if missing:
        raise InvalidUpload(f"missing views: {', '.join(missing)}")
    clean = {a: normalise_view(views[a]) for a in ANGLES}

    job_id = uuid.uuid4().hex
    token = secrets.token_urlsafe(24)
    for angle, data in clean.items():
        p = view_path(job_id, angle)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data)

    name = provider_name()
    job = ModelJob(
        id=job_id,
        token_hash=_hash(token),
        owner_uid=owner_uid,
        client_id=client_id,
        views_json=json.dumps(list(ANGLES)),
        provider=name,
        status="queued" if name != "disabled" else "unavailable",
        error="" if name != "disabled" else "3D generation is not configured on this server",
    )
    session.add(job)
    session.commit()
    session.refresh(job)
    return job, token


def retry(session: Session, job: ModelJob) -> ModelJob:
    if job.status not in ("failed", "unavailable"):
        return job
    if not all(view_path(job.id, a).exists() for a in ANGLES):
        job.status, job.error = "failed", "the photos for this job were removed — capture again"
    else:
        name = provider_name()
        job.status = "queued" if name != "disabled" else "unavailable"
        job.provider = name
        job.error = "" if name != "disabled" else "3D generation is not configured on this server"
        job.attempts = 0
        job.progress = 0
        job.provider_task_id = ""
        job.finished_at = None
    job.updated_at = datetime.now(UTC)
    session.add(job)
    session.commit()
    session.refresh(job)
    return job


def attach_to_listing(session: Session, job_id: str, token: str, listing_id: str) -> bool:
    job = session.get(ModelJob, job_id)
    if job is None or not token_ok(job, token):
        return False
    job.listing_id = listing_id
    job.updated_at = datetime.now(UTC)
    session.add(job)
    session.commit()
    return True


def delete_job_files(job_id: str) -> None:
    shutil.rmtree(job_dir(job_id), ignore_errors=True)


# ------------------------------------------------------------------ worker ---


def _fail(job: ModelJob, message: str) -> None:
    job.status = "failed"
    job.error = message[:300]
    job.finished_at = datetime.now(UTC)


def _step(session: Session, job: ModelJob, provider) -> None:
    now = datetime.now(UTC)
    settings = get_settings()

    if job.status == "queued":
        views = {a: view_path(job.id, a).read_bytes() for a in ANGLES if view_path(job.id, a).exists()}
        try:
            job.provider_task_id = provider.submit(views)
            job.status = "processing"
            job.provider = provider.name
            job.model_version = provider.model_version
            job.submitted_at = now
            job.progress = 1
        except ProviderError as e:
            job.attempts += 1
            if not e.retryable or job.attempts >= MAX_SUBMIT_ATTEMPTS:
                _fail(job, str(e))
        return

    if job.status == "processing":
        submitted = job.submitted_at
        if submitted is not None and submitted.tzinfo is None:
            submitted = submitted.replace(tzinfo=UTC)
        if submitted and (now - submitted).total_seconds() > settings.MODEL3D_TIMEOUT_S:
            _fail(job, "timed out waiting for the 3D model")
            return
        try:
            st = provider.poll(job.provider_task_id)
        except ProviderError as e:
            if not e.retryable:
                _fail(job, str(e))
            return  # retryable: try again next tick
        job.progress = max(job.progress, min(99, st.progress))
        if st.state == "failed":
            _fail(job, st.error or "the 3D service could not build this model")
        elif st.state == "succeeded":
            try:
                glb = provider.fetch_glb(st)
            except ProviderError as e:
                if not e.retryable:
                    _fail(job, str(e))
                return
            path = model_path(job.id)
            path.parent.mkdir(parents=True, exist_ok=True)
            tmp = path.with_suffix(".tmp")
            tmp.write_bytes(glb)
            tmp.replace(path)  # atomic: the viewer never sees half a file
            job.status = "ready"
            job.has_model = True
            job.model_bytes = len(glb)
            job.progress = 100
            job.finished_at = now


def process_pending_once() -> int:
    """One pass over every unfinished job. Returns how many were touched."""
    provider = get_provider()
    if provider is None:
        return 0
    touched = 0
    with Session(get_engine()) as session:
        jobs = session.exec(select(ModelJob).where(ModelJob.status.in_(("queued", "processing")))).all()
        for job in jobs:
            try:
                _step(session, job, provider)
            except Exception as e:  # never let one bad job kill the loop
                log.exception("model job %s crashed", job.id)
                _fail(job, f"internal error: {e.__class__.__name__}")
            job.updated_at = datetime.now(UTC)
            session.add(job)
            session.commit()
            touched += 1
    return touched


def cleanup_expired() -> int:
    """Delete views + models of jobs never attached to a published product.

    Photos of an unpublished product have no reason to live on our disk
    forever. Attached jobs are kept: their views are the storefront gallery.
    """
    days = get_settings().MODEL3D_RETENTION_DAYS
    cutoff = datetime.now(UTC) - timedelta(days=days)
    removed = 0
    with Session(get_engine()) as session:
        for job in session.exec(select(ModelJob).where(ModelJob.listing_id.is_(None))).all():
            created = job.created_at if job.created_at.tzinfo else job.created_at.replace(tzinfo=UTC)
            if created < cutoff and job.status != "expired":
                delete_job_files(job.id)
                job.status, job.has_model, job.error = "expired", False, "removed after retention period"
                session.add(job)
                removed += 1
        session.commit()
    return removed


async def worker_loop(stop: asyncio.Event, interval: float = 4.0) -> None:
    """Background worker, started from the app lifespan.

    In-process and single-instance by design for this deployment size; the
    job table is the queue, so moving this to a separate worker process later
    means running the same loop there — no API change.
    """
    last_cleanup = 0.0
    loop = asyncio.get_running_loop()
    while not stop.is_set():
        try:
            await asyncio.to_thread(process_pending_once)
            if loop.time() - last_cleanup > 6 * 3600:
                await asyncio.to_thread(cleanup_expired)
                last_cleanup = loop.time()
        except Exception:
            log.exception("model worker tick failed")
        try:
            await asyncio.wait_for(stop.wait(), timeout=interval)
        except TimeoutError:
            pass
