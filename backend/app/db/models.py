"""SQLModel tables backing the public storefront.

A published listing has to outlive the HTTP response that created it: the
judge scans the QR code and their phone hits `GET /p/{id}` seconds or minutes
later, from a different device. Before this, publish returned an id that
referred to nothing.
"""
from __future__ import annotations

import json
from datetime import UTC, datetime

from sqlmodel import Field, SQLModel


class Artisan(SQLModel, table=True):
    """Whoever made the thing.

    Phase 3 gives them an account: uid/email/phone come from Firebase (or the
    local demo account), and `plan` drives the Free vs Pro badge. Still thin —
    no passwords are ever stored here; auth lives in Firebase.
    """

    id: int | None = Field(default=None, primary_key=True)
    uid: str | None = Field(default=None, index=True)  # Firebase uid or demo uid
    name: str = Field(index=True)
    location: str = ""
    email: str = ""
    phone: str = ""
    photo_url: str = ""
    plan: str = "free"  # "free" | "pro"


class ChannelConnection(SQLModel, table=True):
    """An artisan's connection to a sales channel.

    ONDC is a real connection; the rest are simulated ("demo") — this table
    only records that the artisan flipped the toggle, never any credentials.
    """

    id: int | None = Field(default=None, primary_key=True)
    artisan_id: int | None = Field(default=None, foreign_key="artisan.id", index=True)
    channel_id: str = Field(index=True)
    connected: bool = True
    mode: str = "demo"  # "live" (ONDC) | "demo"
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class ChannelPublish(SQLModel, table=True):
    """One (listing, channel) publish record.

    ONDC publishes are real (storefront + QR); the rest are recorded as
    "published (demo)" with a synthetic reference so the per-channel result
    list is believable without ever calling an external marketplace.
    """

    id: int | None = Field(default=None, primary_key=True)
    listing_id: str = Field(index=True)
    channel_id: str = Field(index=True)
    status: str = ""            # e.g. "Live on ONDC" | "Published (demo)"
    mode: str = "demo"          # "live" | "demo"
    channel_ref: str = ""       # synthetic per-channel id
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class Listing(SQLModel, table=True):
    """One published product.

    `id` is the `KARIGAR-XXXXXXXX` minted by ondc_service, reused verbatim as
    the public URL slug so the ONDC catalog item and the storefront page agree
    on one identifier.
    """

    id: str = Field(primary_key=True)
    artisan_id: int | None = Field(default=None, foreign_key="artisan.id")

    # One column per supported language. Gemini already drafts the artisan's
    # own tongue, but with only en/hi/kn columns that output was generated and
    # then dropped on save — so a Tamil artisan's Tamil title never survived
    # the round trip, and localised() fell back to English forever.
    title_en: str = ""
    title_hi: str = ""
    title_kn: str = ""
    title_ta: str = ""
    title_te: str = ""
    title_bn: str = ""
    title_mr: str = ""
    title_gu: str = ""
    title_or: str = ""
    description_en: str = ""
    description_hi: str = ""
    description_kn: str = ""
    description_ta: str = ""
    description_te: str = ""
    description_bn: str = ""
    description_mr: str = ""
    description_gu: str = ""
    description_or: str = ""

    material: str = ""
    category: str = ""
    craft_technique: str = ""
    production_time: str = ""
    dimensions: str = ""
    gi_candidate: str | None = None
    # Registry-verified GI (see gi_service). gi_verified drives the green badge.
    gi_verified: bool = False
    gi_registry_name: str | None = None
    gi_state: str | None = None
    tags_json: str = "[]"

    price: int = 0
    image_b64: str = ""
    # The 3D job built from this product's six capture views, if any. The
    # model itself lives on the job (status, file, version) so a model that
    # finishes AFTER publishing still appears on the storefront.
    model_job_id: str | None = Field(default=None, index=True)
    # Which text fields the artisan edited by hand (JSON list). Everything
    # else in the listing text was AI-drafted — shown to buyers as such.
    edited_fields_json: str = "[]"
    # Impact counters: storefront opens and QR scans (see /api/impact).
    views: int = 0
    scans: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    @property
    def tags(self) -> list[str]:
        try:
            loaded = json.loads(self.tags_json)
        except ValueError:
            return []
        return loaded if isinstance(loaded, list) else []

    def title(self, lang: str = "en") -> str:
        """Title in `lang`, falling back to English rather than to nothing."""
        return getattr(self, f"title_{lang}", "") or self.title_en

    def description(self, lang: str = "en") -> str:
        return getattr(self, f"description_{lang}", "") or self.description_en


class ModelJob(SQLModel, table=True):
    """One 3D reconstruction: six capture views in, a GLB out.

    Lives independently of Listing because capture happens at the START of
    the selling flow, long before a listing exists; publish attaches it.

    `id` is 128 bits of randomness and doubles as the capability in the
    public model URL. `token_hash` guards everything else (status, retry,
    raw views) for the device that created it.
    """

    id: str = Field(primary_key=True)
    token_hash: str = ""
    owner_uid: str | None = Field(default=None, index=True)
    # Device-generated idempotency key: an offline upload retried five times
    # must create one job, not five.
    client_id: str = Field(default="", index=True)
    listing_id: str | None = Field(default=None, index=True)

    # queued -> processing -> ready | failed   (and expired, after cleanup)
    status: str = Field(default="queued", index=True)
    provider: str = ""
    provider_task_id: str = ""
    model_version: str = ""
    progress: int = 0
    attempts: int = 0
    error: str = ""
    views_json: str = "[]"  # angles stored, e.g. ["front", ...]
    has_model: bool = False
    model_bytes: int = 0

    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    submitted_at: datetime | None = None
    finished_at: datetime | None = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    @property
    def views(self) -> list[str]:
        try:
            v = json.loads(self.views_json)
        except ValueError:
            return []
        return v if isinstance(v, list) else []
