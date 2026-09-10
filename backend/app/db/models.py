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

    title_en: str = ""
    title_hi: str = ""
    title_kn: str = ""
    description_en: str = ""
    description_hi: str = ""
    description_kn: str = ""

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
