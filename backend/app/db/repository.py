"""Read/write helpers for published listings.

Kept separate from `main.py` so the route stays readable: publish is already
doing catalog-building and link-minting.
"""
from __future__ import annotations

import json

from sqlmodel import Session, select

from .models import Artisan, Listing


def _get_or_create_artisan(session: Session, name: str, location: str) -> Artisan:
    """One row per (name, location).

    Publishing five items from the same demo shouldn't create five artisans.
    """
    name = (name or "Artisan").strip() or "Artisan"
    location = (location or "").strip()
    artisan = session.exec(
        select(Artisan).where(Artisan.name == name, Artisan.location == location)
    ).first()
    if artisan is None:
        artisan = Artisan(name=name, location=location)
        session.add(artisan)
        session.flush()  # populates artisan.id without committing yet
    return artisan


def save_listing(
    session: Session,
    *,
    listing_id: str,
    listing: dict,
    price: int,
    image_b64: str | None,
    artisan_name: str,
    location: str,
) -> Listing:
    artisan = _get_or_create_artisan(session, artisan_name, location)
    title = listing.get("title") or {}
    desc = listing.get("description") or {}

    row = Listing(
        id=listing_id,
        artisan_id=artisan.id,
        title_en=title.get("en", ""),
        title_hi=title.get("hi", ""),
        title_kn=title.get("kn", ""),
        description_en=desc.get("en", ""),
        description_hi=desc.get("hi", ""),
        description_kn=desc.get("kn", ""),
        material=listing.get("material", "") or "",
        category=listing.get("category", "") or "",
        craft_technique=listing.get("craft_technique", "") or "",
        production_time=listing.get("production_time", "") or "",
        dimensions=listing.get("dimensions", "") or "",
        gi_candidate=listing.get("gi_candidate"),
        gi_verified=bool(listing.get("gi_verified")),
        gi_registry_name=listing.get("gi_registry_name"),
        gi_state=listing.get("gi_state"),
        tags_json=json.dumps(listing.get("tags") or [], ensure_ascii=False),
        price=int(price),
        image_b64=image_b64 or "",
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


def get_listing(session: Session, listing_id: str) -> Listing | None:
    return session.get(Listing, listing_id)


def recent_listings(session: Session, limit: int = 24) -> list[Listing]:
    """Newest first — the artisan's most recent work is what they want to see."""
    return list(
        session.exec(
            select(Listing).order_by(Listing.created_at.desc()).limit(limit)
        ).all()
    )


def get_artisan(session: Session, artisan_id: int | None) -> Artisan | None:
    return session.get(Artisan, artisan_id) if artisan_id is not None else None
