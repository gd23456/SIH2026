"""Shopify Admin API — a second REAL live publish channel (alongside ONDC).

When SHOPIFY_STORE_DOMAIN + SHOPIFY_ADMIN_TOKEN are set, publish_product() creates
a real product on a real Shopify store and returns its live URL. When they are
absent — or any call fails — it returns {ok: False, reason} so the publish loop
records an honest demo result instead. It NEVER raises out to /api/publish: a
network/credential problem must degrade gracefully, never break the demo.
"""
from __future__ import annotations

import logging

import httpx

from ..config import get_settings

log = logging.getLogger("karigar.shopify")

_API_VERSION = "2024-10"
_TIMEOUT = 10.0


def is_configured() -> bool:
    s = get_settings()
    return bool(s.SHOPIFY_STORE_DOMAIN.strip() and s.SHOPIFY_ADMIN_TOKEN.strip())


def _store() -> str:
    # Accept either "store.myshopify.com" or a full URL; normalise to host.
    raw = get_settings().SHOPIFY_STORE_DOMAIN.strip()
    return raw.replace("https://", "").replace("http://", "").strip("/")


def _headers() -> dict:
    return {
        "X-Shopify-Access-Token": get_settings().SHOPIFY_ADMIN_TOKEN.strip(),
        "Content-Type": "application/json",
    }


def publish_product(listing: dict, price: int, image_b64: str | None = None,
                    artisan_name: str = "Karigar Artisan") -> dict:
    """Create a live product on the configured Shopify store.

    Returns {ok, product_id, admin_url, online_url, handle} on success, or
    {ok: False, reason} on any failure / when not configured.
    """
    if not is_configured():
        return {"ok": False, "reason": "not_configured"}

    title = (listing.get("title") or {}).get("en") or "Handcrafted Product"
    body_html = (listing.get("description") or {}).get("en") or ""
    tags = ",".join(listing.get("tags") or [])

    product: dict = {
        "title": title,
        "body_html": body_html,
        "tags": tags,
        "status": "active",
        "vendor": artisan_name or "Karigar Artisan",
        "variants": [{"price": str(int(price))}],
    }
    if image_b64:
        # Shopify wants raw base64 with no data: prefix.
        product["images"] = [{"attachment": image_b64}]

    store = _store()
    url = f"https://{store}/admin/api/{_API_VERSION}/products.json"
    try:
        resp = httpx.post(url, headers=_headers(), json={"product": product}, timeout=_TIMEOUT)
        if resp.status_code not in (200, 201):
            log.warning("Shopify publish failed: HTTP %s %s", resp.status_code, resp.text[:300])
            return {"ok": False, "reason": f"http_{resp.status_code}"}
        p = resp.json().get("product", {})
        pid = p.get("id")
        handle = p.get("handle", "")
        return {
            "ok": True,
            "product_id": pid,
            "handle": handle,
            "online_url": f"https://{store}/products/{handle}" if handle else f"https://{store}",
            "admin_url": f"https://{store}/admin/products/{pid}" if pid else f"https://{store}/admin",
        }
    except Exception as e:  # network, timeout, JSON — never propagate
        log.warning("Shopify publish error, downgrading to demo: %s", e)
        return {"ok": False, "reason": "error"}


def health() -> dict:
    """Lightweight check that the token/store work (shop.json). Best-effort."""
    if not is_configured():
        return {"ok": False, "reason": "not_configured"}
    store = _store()
    try:
        resp = httpx.get(
            f"https://{store}/admin/api/{_API_VERSION}/shop.json",
            headers=_headers(), timeout=_TIMEOUT,
        )
        return {"ok": resp.status_code == 200, "status": resp.status_code}
    except Exception as e:
        return {"ok": False, "reason": str(e)}
