"""Karigar AI — FastAPI backend.

Endpoints:
  GET  /                     -> health + mode
  GET  /api/health           -> health + mode (mock vs live)
  POST /api/enhance-image    -> multipart image -> {original_b64, enhanced_b64, bg_removed}
  POST /api/generate-listing -> {transcript, language, image_b64?} -> multilingual Listing
  POST /api/price            -> product attrs -> fair price + reasoning
  POST /api/publish          -> listing+price -> ONDC catalog + share links
"""
from __future__ import annotations

import logging

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .schemas import (
    GenerateListingRequest,
    PriceRequest,
    PublishRequest,
    PublishResponse,
)
from .services import gemini_service, image_service, ondc_service, pricing_service

logging.basicConfig(level=logging.INFO)
settings = get_settings()

app = FastAPI(title="Karigar AI", version="0.1.0", description="AI co-seller for artisans")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list + ["*"],  # permissive for hackathon/demo
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _mode() -> str:
    return "mock" if settings.use_mock else "live (Gemini)"


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
    return gemini_service.generate_listing(req.transcript, req.language, req.image_b64)


@app.post("/api/price")
def price(req: PriceRequest):
    return pricing_service.fair_price(req.model_dump())


@app.post("/api/publish", response_model=PublishResponse)
def publish(req: PublishRequest):
    listing = req.listing.model_dump()
    catalog = ondc_service.build_ondc_catalog(listing, req.price, req.artisan_name, req.location)
    listing_id = catalog.pop("_listing_id")
    storefront = f"https://karigar.ai/p/{listing_id}"
    title = listing.get("title", {}).get("en", "Handcrafted Product")
    return PublishResponse(
        listing_id=listing_id,
        status="PUBLISHED",
        ondc_catalog=catalog,
        whatsapp_share_url=ondc_service.whatsapp_share(title, req.price, storefront),
        storefront_url=storefront,
    )
