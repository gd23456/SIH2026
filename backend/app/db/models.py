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
    """Whoever made the thing. Deliberately thin — no auth in Phase 1."""

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    location: str = ""


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
