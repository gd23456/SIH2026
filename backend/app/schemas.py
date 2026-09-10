"""Pydantic request/response models."""

from datetime import datetime

from pydantic import BaseModel, Field


class LocalizedText(BaseModel):
    # en/hi/kn are always generated. The other six are populated only when the
    # artisan chose that language, so the listing carries their tongue too.
    en: str = ""
    hi: str = ""
    kn: str = ""
    ta: str = ""
    te: str = ""
    bn: str = ""
    mr: str = ""
    gu: str = ""
    or_: str = Field("", alias="or")

    model_config = {"populate_by_name": True}


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
    # Phase 3: the signed-in artisan and the channels to publish to. ONDC is
    # always the real one; anything else is recorded as a demo publish.
    artisan_uid: str | None = None
    artisan_email: str = ""
    artisan_photo_url: str = ""
    channels: list[str] = ["ondc"]


# --- accounts (Phase 3) ----------------------------------------------------


class ArtisanUpsert(BaseModel):
    uid: str = Field(..., description="Firebase uid, or a local demo uid")
    # Empty = "not provided": upsert only overwrites stored fields with
    # non-empty values, so a partial edit never blanks name/photo/etc.
    name: str = ""
    email: str = ""
    phone: str = ""
    photo_url: str = ""
    location: str = ""
    plan: str = ""  # only overwrites when non-empty


class ArtisanOut(BaseModel):
    id: int | None = None
    uid: str | None = None
    name: str = "Artisan"
    email: str = ""
    phone: str = ""
    photo_url: str = ""
    location: str = ""
    plan: str = "free"
    listing_count: int = 0


# --- channels (Phase 3) ----------------------------------------------------


class ChannelInfo(BaseModel):
    id: str
    name: str
    kind: str  # "live" | "demo" | "coming_soon"
    logo: str = ""
    note: str = ""
    connected: bool = False
    mode: str = "demo"
    # A "live" channel is only truly live when its backend credentials exist
    # (ONDC always; Shopify only when SHOPIFY_* env vars are set).
    configured: bool = True


class ChannelResult(BaseModel):
    channel_id: str
    name: str
    kind: str
    mode: str
    status: str
    ref: str = ""
    storefront_url: str | None = None
    qr_url: str | None = None


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
    # Per-channel outcome — ONDC live, the rest recorded as demo publishes.
    channel_results: list[ChannelResult] = []
