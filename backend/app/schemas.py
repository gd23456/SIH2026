"""Pydantic request/response models."""

from datetime import datetime

from pydantic import BaseModel, Field


class LocalizedText(BaseModel):
    en: str = ""
    hi: str = ""
    kn: str = ""


class GenerateListingRequest(BaseModel):
    transcript: str = Field(..., description="What the artisan said, in their language")
    language: str = Field("en", description="BCP-47-ish code of the spoken language: en | hi | kn")
    image_b64: str | None = Field(None, description="Optional enhanced product image (base64, no data: prefix)")


class Listing(BaseModel):
    title: LocalizedText
    description: LocalizedText
    material: str = ""
    category: str = ""
    craft_technique: str = ""
    production_time: str = ""
    dimensions: str = ""
    tags: list[str] = []
    gi_candidate: str | None = Field(None, description="Possible GI (Geographical Indication) tag — the LLM's *guess*")
    # Registry-verified GI (distinct from the LLM guess above). Set by
    # gi_service.verify() against data/gi_registry.json.
    gi_verified: bool = False
    gi_registry_name: str | None = None
    gi_state: str | None = None


class PriceRequest(BaseModel):
    material: str = ""
    category: str = ""
    production_time: str = ""
    craft_technique: str = ""
    title: str = ""


class PriceBreakdown(BaseModel):
    label: str
    amount: int


class PriceResponse(BaseModel):
    suggested_price: int
    min_price: int
    max_price: int
    currency: str = "INR"
    reasoning: list[str]
    breakdown: list[PriceBreakdown]
    market_note: str = ""
    # Grounding signals (Fair-Price engine). market_* are 0/"" when no
    # comparable category matched; wage_floor_applied is True when the
    # fair-wage floor was the binding constraint on the suggested price.
    market_median: int = 0
    market_sample_count: int = 0
    market_source: str = ""
    wage_floor: int = 0
    wage_floor_applied: bool = False
    # Verified-GI premium (a registry-verified GI is priced above a generic
    # equivalent — a verified Channapatna toy ≠ a generic wooden toy).
    gi_verified: bool = False
    gi_premium_applied: bool = False


class PublishRequest(BaseModel):
    listing: Listing
    price: int
    image_b64: str | None = None
    artisan_name: str = "Artisan"
    location: str = "India"


class ListingSummary(BaseModel):
    """One row in the artisan's "My Products" grid.

    Deliberately omits the image blob: a grid of 24 listings would otherwise
    ship ~1MB of base64 to a phone on a hotspot. `image_url` points at
    /api/listings/{id}/image instead, so the browser fetches thumbnails
    lazily and caches them.
    """

    listing_id: str
    title: LocalizedText
    price: int
    category: str = ""
    gi_candidate: str | None = None
    gi_verified: bool = False
    gi_state: str | None = None
    has_image: bool = False
    image_url: str
    storefront_url: str
    created_at: datetime


class PublishResponse(BaseModel):
    listing_id: str
    status: str
    ondc_catalog: dict
    whatsapp_share_url: str
    storefront_url: str
