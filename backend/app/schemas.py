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
    gi_candidate: str | None = Field(None, description="Possible GI (Geographical Indication) tag match")


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
