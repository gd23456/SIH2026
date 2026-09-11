"""Read/write helpers for published listings.

Kept separate from `main.py` so the route stays readable: publish is already
doing catalog-building and link-minting.
"""
from __future__ import annotations

import json

from sqlalchemy import func
from sqlmodel import Session, select

from .models import Artisan, ChannelConnection, ChannelPublish, Listing


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


# --- accounts (Phase 3) ----------------------------------------------------


def get_artisan_by_uid(session: Session, uid: str) -> Artisan | None:
    if not uid:
        return None
    return session.exec(select(Artisan).where(Artisan.uid == uid)).first()


def upsert_artisan(session: Session, *, uid: str, **fields) -> Artisan:
    """Create or update the account keyed by Firebase/demo uid.

    Only non-empty incoming fields overwrite stored ones, so a partial update
    (e.g. editing just the location) never blanks the name or photo.
    """
    artisan = get_artisan_by_uid(session, uid)
    if artisan is None:
        artisan = Artisan(uid=uid, name=(fields.get("name") or "Artisan"))
        session.add(artisan)

    for key in ("name", "location", "email", "phone", "photo_url", "plan"):
        val = fields.get(key)
        if val:
            setattr(artisan, key, val)

    session.commit()
    session.refresh(artisan)
    return artisan


# --- channels (Phase 3) ----------------------------------------------------


def set_channel_connection(session: Session, *, artisan_id: int, channel_id: str,
                           connected: bool = True, mode: str = "demo") -> ChannelConnection:
    row = session.exec(
        select(ChannelConnection).where(
            ChannelConnection.artisan_id == artisan_id,
            ChannelConnection.channel_id == channel_id,
        )
    ).first()
    if row is None:
        row = ChannelConnection(artisan_id=artisan_id, channel_id=channel_id)
        session.add(row)
    row.connected = connected
    row.mode = mode
    session.commit()
    session.refresh(row)
    return row


def connected_channels(session: Session, artisan_id: int | None) -> set[str]:
    if artisan_id is None:
        return set()
    rows = session.exec(
        select(ChannelConnection).where(
            ChannelConnection.artisan_id == artisan_id,
            ChannelConnection.connected == True,  # noqa: E712
        )
    ).all()
    return {r.channel_id for r in rows}


def record_channel_publish(session: Session, *, listing_id: str, channel_id: str,
                           status: str, mode: str, channel_ref: str) -> ChannelPublish:
    row = ChannelPublish(
        listing_id=listing_id, channel_id=channel_id,
        status=status, mode=mode, channel_ref=channel_ref,
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


def save_listing(
    session: Session,
    *,
    listing_id: str,
    listing: dict,
    price: int,
    image_b64: str | None,
    artisan_name: str,
    location: str,
    artisan_uid: str | None = None,
    artisan_email: str = "",
    artisan_photo_url: str = "",
) -> Listing:
    # A signed-in artisan (real uid) owns the listing; otherwise fall back to
    # the name/location identity so anonymous/demo publishes still work.
    if artisan_uid:
        artisan = upsert_artisan(
            session, uid=artisan_uid, name=artisan_name, location=location,
            email=artisan_email, photo_url=artisan_photo_url,
        )
    else:
        artisan = _get_or_create_artisan(session, artisan_name, location)
    title = listing.get("title") or {}
    desc = listing.get("description") or {}

    row = Listing(
        id=listing_id,
        artisan_id=artisan.id,
        title_en=title.get("en", "") or "",
        title_hi=title.get("hi", "") or "",
        title_kn=title.get("kn", "") or "",
        title_ta=title.get("ta", "") or "",
        title_te=title.get("te", "") or "",
        title_bn=title.get("bn", "") or "",
        title_mr=title.get("mr", "") or "",
        title_gu=title.get("gu", "") or "",
        title_or=title.get("or", "") or "",
        description_en=desc.get("en", "") or "",
        description_hi=desc.get("hi", "") or "",
        description_kn=desc.get("kn", "") or "",
        description_ta=desc.get("ta", "") or "",
        description_te=desc.get("te", "") or "",
        description_bn=desc.get("bn", "") or "",
        description_mr=desc.get("mr", "") or "",
        description_gu=desc.get("gu", "") or "",
        description_or=desc.get("or", "") or "",
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


def recent_listings(
    session: Session,
    limit: int = 24,
    artisan_id: int | None = None,
    with_image_only: bool = False,
) -> list[Listing]:
    """Newest first — the artisan's most recent work is what they want to see.

    `artisan_id` scopes this to one artisan. Without it this returns the whole
    catalogue, which is right for the home strip but wrong for "My Products":
    that screen offers a delete button, and it must never offer one over
    somebody else's listing.
    """
    stmt = select(Listing)
    if artisan_id is not None:
        stmt = stmt.where(Listing.artisan_id == artisan_id)
    if with_image_only:
        stmt = stmt.where(Listing.image_b64 != "")
    return list(session.exec(stmt.order_by(Listing.created_at.desc()).limit(limit)).all())


def search_listings(session: Session, query: str, limit: int = 24) -> list[Listing]:
    """Buyer-side search over published listings.

    Matches the query (case-insensitive) against the English/Hindi/Kannada
    title, category and the tags blob — enough to find "the item you just
    published" in the buyer view. An empty query returns the newest listings,
    so the buyer screen has something to show before anyone types.

    Listings with no photo are excluded. A buyer catalogue tile is mostly
    image, so a photo-less row renders as an empty grey square that looks like
    a broken page — and nobody buys a craft they cannot see. They stay visible
    in the artisan's own My Products, where they can be fixed or deleted.
    """
    q = (query or "").strip()
    if not q:
        return recent_listings(session, limit=limit, with_image_only=True)

    like = f"%{q.lower()}%"
    stmt = (
        select(Listing)
        .where(Listing.image_b64 != "")
        .where(
            func.lower(Listing.title_en).like(like)
            | func.lower(Listing.title_hi).like(like)
            | func.lower(Listing.title_kn).like(like)
            | func.lower(Listing.category).like(like)
            | func.lower(Listing.tags_json).like(like)
            | func.lower(Listing.material).like(like)
        )
        .order_by(Listing.created_at.desc())
        .limit(limit)
    )
    return list(session.exec(stmt).all())


def delete_listing(session: Session, listing_id: str, artisan_id: int) -> str:
    """Delete one listing and its publish records.

    Returns "ok", "missing", or "forbidden" rather than raising: the route
    turns those into status codes, and the distinction matters — a 403 on
    someone else's listing must not be reported as a 404, which would let a
    caller probe which ids exist.

    The ChannelPublish rows go too. There is no FK cascade here, and leaving
    them behind would keep inflating channels_reached on the impact card with
    channels reached by a listing that no longer exists.
    """
    row = session.get(Listing, listing_id)
    if row is None:
        return "missing"
    if row.artisan_id != artisan_id:
        return "forbidden"
    for pub in session.exec(
        select(ChannelPublish).where(ChannelPublish.listing_id == listing_id)
    ).all():
        session.delete(pub)
    session.delete(row)
    session.commit()
    return "ok"


def get_artisan(session: Session, artisan_id: int | None) -> Artisan | None:
    return session.get(Artisan, artisan_id) if artisan_id is not None else None


def listing_count(session: Session, artisan_id: int | None) -> int:
    if artisan_id is None:
        return 0
    return len(session.exec(select(Listing.id).where(Listing.artisan_id == artisan_id)).all())


# --- impact (Phase 3) ------------------------------------------------------


def bump_counter(session: Session, listing_id: str, field: str) -> None:
    """Increment a listing's 'views' or 'scans' counter. Silent if unknown."""
    if field not in ("views", "scans"):
        return
    row = session.get(Listing, listing_id)
    if row is None:
        return
    setattr(row, field, (getattr(row, field) or 0) + 1)
    session.add(row)
    session.commit()


def impact(session: Session, artisan_id: int | None) -> dict:
    """Aggregate impact numbers for an artisan across their listings."""
    if artisan_id is None:
        return {"products": 0, "channels_reached": 0, "total_views": 0,
                "total_scans": 0}

    rows = list(session.exec(select(Listing).where(Listing.artisan_id == artisan_id)).all())
    listing_ids = [r.id for r in rows]

    total_views = sum(r.views or 0 for r in rows)
    total_scans = sum(r.scans or 0 for r in rows)

    channels: set[str] = set()
    if listing_ids:
        pubs = session.exec(
            select(ChannelPublish.channel_id).where(ChannelPublish.listing_id.in_(listing_ids))
        ).all()
        channels = set(pubs)

    return {
        "products": len(rows),
        "channels_reached": len(channels),
        "total_views": total_views,
        "total_scans": total_scans,
    }
