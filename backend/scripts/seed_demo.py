"""Seed a few realistic listings so "My Products" and the Buyer view are never
empty on stage.

Runs the same path a real publish does — mock listing generation, GI
verification, the grounded fair-price engine, ONDC id minting — and writes
straight to the database the server reads, so no server needs to be running.

Usage (from the backend/ directory):

    python scripts/seed_demo.py            # add the demo listings
    python scripts/seed_demo.py --reset    # wipe listings first, then add

It uses the same DATABASE_URL as the app, so seed once and the products show
up in the running server immediately.
"""
from __future__ import annotations

import sys
import uuid
from pathlib import Path

# Windows terminals default to cp1252 and choke on ₹ / bullets; force UTF-8.
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

# Make `app` importable whether run as `python scripts/seed_demo.py` or `-m`.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlmodel import Session, delete  # noqa: E402

from app.db import get_engine, init_db  # noqa: E402
from app.db import repository as repo  # noqa: E402
from app.db.models import Artisan, Listing  # noqa: E402
from app.services import gemini_service, gi_service, pricing_service  # noqa: E402

# (spoken transcript, language, artisan, location) — one per craft. The mock is
# keyword-aware, so these produce distinct, well-formed listings offline.
DEMOS = [
    ("Handmade bamboo storage basket, takes three days", "kn", "Lakshmi Devi", "Kollegala, Karnataka"),
    ("Channapatna wooden spinning top toy set for kids", "kn", "Ravi Kumar", "Channapatna, Karnataka"),
    ("Handloom Mysore silk saree with gold zari", "kn", "Saroja Bai", "Mysuru, Karnataka"),
    ("Hand-thrown terracotta clay vase", "hi", "Meena Kumari", "Jaipur, Rajasthan"),
]


def _reset(session: Session) -> None:
    session.exec(delete(Listing))
    session.exec(delete(Artisan))
    session.commit()
    print("• cleared existing listings")


def seed(reset: bool = False) -> None:
    init_db()
    with Session(get_engine()) as session:
        if reset:
            _reset(session)

        for transcript, lang, artisan, location in DEMOS:
            listing = gemini_service.generate_listing(transcript, lang)
            gi = gi_service.verify(listing)
            listing["gi_verified"] = gi["matched"]
            listing["gi_registry_name"] = gi["name"] or None
            listing["gi_state"] = gi["state"] or None

            price = pricing_service.fair_price(
                {
                    "title": listing.get("title", {}).get("en", ""),
                    "material": listing.get("material", ""),
                    "category": listing.get("category", ""),
                    "craft_technique": listing.get("craft_technique", ""),
                    "production_time": listing.get("production_time", ""),
                }
            )["suggested_price"]

            listing_id = f"KARIGAR-{uuid.uuid4().hex[:8].upper()}"
            repo.save_listing(
                session,
                listing_id=listing_id,
                listing=listing,
                price=price,
                image_b64=None,
                artisan_name=artisan,
                location=location,
            )
            badge = f" ✓GI:{gi['name']}" if gi["matched"] else ""
            print(f"• {listing_id}  ₹{price:<6} {listing['title']['en']}{badge}")

    print("\nDone. Open 'My Products' or the Buyer view — the shelf is stocked.")


if __name__ == "__main__":
    seed(reset="--reset" in sys.argv)
