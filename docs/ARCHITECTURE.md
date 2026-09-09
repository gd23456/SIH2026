# Architecture

## Principle: nothing may break the demo

Every AI call in this system has a fallback, and every fallback has a fallback.
That isn't defensive coding for its own sake — it's the design constraint. A
hackathon demo runs on venue wifi, on a free API tier, on a borrowed phone.
The architecture assumes all three will fail.

---

## System shape

```
┌─────────────────────────────────────────────────────────────────┐
│  ARTISAN'S PHONE                                                │
│  React 18 PWA · Capacitor 6 (Android) · Tailwind                │
│                                                                 │
│  Welcome → Photo → Voice → Review → Price → Publish             │
│     │        │       │        │        │        │               │
│     │     camera   mic     edit     accept    QR + share         │
│     │                                                           │
│  lib/api.js ── every call wrapped: network failure → demoData   │
└──────────────────────────┬──────────────────────────────────────┘
                           │  REST / JSON  (12–25s timeouts)
┌──────────────────────────▼──────────────────────────────────────┐
│  FastAPI BACKEND                                                │
│                                                                 │
│  POST /api/enhance-image   → image_service   → rembg U²-Net     │
│                                              → PIL studio comp  │
│  POST /api/generate-listing → gemini_service → Gemini vision    │
│  POST /api/price            → pricing_service→ Gemini + rules   │
│  POST /api/publish          → ondc_service   → ONDC:RET10       │
│                             → db.repository  → SQLite           │
│  GET  /api/listings         → db.repository  → My Products      │
│  GET  /p/{id}               → Jinja2         → storefront page  │
│  GET  /api/qr/{id}          → qrcode         → PNG              │
│  GET  /api/health           → which mode am I actually in?      │
│                                                                 │
│  Every service: try live → on ANY exception → mock_data         │
└─────────────────────────────────────────────────────────────────┘
```

---

## The three-layer fallback

This is the most important thing to understand about the codebase.

```
Layer 1  FRONTEND    lib/api.js catches network failure
                     → demoData.js canned responses
                     → triggered by karigar_demo=1, or automatically

Layer 2  BACKEND     gemini_service catches key/quota/network/parse errors
                     → mock_data.py keyword-aware canned AI
                     → triggered by FORCE_MOCK=1, or no key, or any exception

Layer 3  SERVICE     image_service catches missing rembg
                     → studio-light the whole photo instead of cutting out
```

**Consequence:** you can unplug the network, delete the API key, and uninstall
rembg, and the full 5-step flow still completes. Verify this before demo day.

`mock_data.py` is keyword-aware, not random — it reads the transcript and
matches a craft. That's why the mock path looks convincing on stage.

---

## Backend modules

| Module | Responsibility | Live path | Fallback |
|---|---|---|---|
| `main.py` | Routes, CORS, error mapping | — | — |
| `config.py` | Env settings; decides mock vs live | `.env` | defaults |
| `schemas.py` | Pydantic request/response contracts | — | — |
| `services/image_service.py` | Background removal + studio composite | rembg U²-Net | PIL enhance only |
| `services/gemini_service.py` | Multilingual listing + price reasoning | Gemini | `mock_data` |
| `services/pricing_service.py` | Fair-price normalisation | Gemini | `mock_data` |
| `services/ondc_service.py` | ONDC catalog payload + share links | — | deterministic |
| `mock_data.py` | Keyword-aware canned crafts | — | — |

### Model resolution

`GEMINI_MODEL` is a *preference*, not a hard requirement. `gemini_service`
tries the configured model, then walks a fallback list
(`gemini-2.5-flash` → `gemini-2.0-flash` → `gemini-1.5-flash`), caches whichever
worked, and reports it at `/api/health` as `model`. A stale model name in
someone's `.env` therefore can't silently cost us the live AI demo.

---

## Frontend structure

```
frontend/src/
├── App.jsx                 5-step state machine (step, listing, price, image)
├── components/
│   ├── Welcome.jsx         language picker
│   ├── PhotoStep.jsx       capture → enhance → before/after
│   ├── VoiceStep.jsx       mic (Web Speech / native) → transcript
│   ├── ReviewStep.jsx      generated listing, editable
│   ├── PriceStep.jsx       fair price + reasoning + breakdown
│   ├── PublishStep.jsx     ONDC publish → share links
│   └── ui.jsx              Header, Stepper, Spinner
└── lib/
    ├── api.js              fetch + timeout + demo fallback + source tracking
    ├── i18n.js             all UI strings (en/hi/kn) — NEVER hardcode strings
    ├── speech.js           Web Speech API / Capacitor SpeechRecognition
    └── demoData.js         client-side canned responses
```

State lives entirely in `App.jsx` and flows down. No state library — at this
size it would be overhead.

### The source badge
`lib/api.js` tracks whether the last response was `live` or `demo` and the
header shows it. During development this instantly answers "why is it showing
the same basket every time?"

---

## Data flow: one product, end to end

```
1. Photo       File → multipart POST → rembg cutout → studio composite
               → {original_b64, enhanced_b64, bg_removed}

2. Voice       Speech → transcript string (artisan's language)

3. Listing     {transcript, language, image_b64}
               → Gemini vision + strict-JSON prompt
               → {title{en,hi,kn}, description{en,hi,kn}, material,
                  category, craft_technique, production_time, dimensions,
                  tags[], gi_candidate}

4. Price       {title, material, category, technique, production_time}
               → {suggested_price, min, max, reasoning[], breakdown[],
                  market_note}

5. Publish     {listing, price, artisan_name, location}
               → ONDC:RET10 catalog + listing_id + storefront + WhatsApp link
```

---

## Design decisions worth defending to a judge

**Voice-first, not form-first.** The target user has low digital literacy and
may not type comfortably in any script. Every screen works with one thumb and
one sentence of speech.

**Warm palette, oversized touch targets.** Deliberately not a slick dark-mode
developer aesthetic. Built for a 45-year-old artisan on a cheap Android phone
in daylight.

**Seller-side, not another marketplace.** We don't compete with Amazon or
Meesho for buyers. We solve the reason artisans can't list on them.

**ONDC as distribution, not as a feature.** Publishing to an open network means
every ONDC buyer app becomes a channel. That's the moat — and it's why the
government cares.

---

## Honest status

Be precise about this with judges. Overclaiming to an ONDC judge loses more
than it gains.

| Component | Status |
|---|---|
| Background removal | ✅ Real (rembg U²-Net) |
| Multilingual listing generation | ✅ Real (Gemini vision) |
| Price reasoning | ⚠️ Real LLM call, but **not yet grounded in market data** |
| ONDC catalog | ⚠️ **Schema-correct payload, not yet POSTed to a live BPP.** Requires ONDC seller-app registration. |
| GI-tag detection | ⚠️ LLM guess; registry verification is planned |
| Persistence | 🔜 Phase 1 (SQLite) |
| Public storefront + QR | 🔜 Phase 1 |

---

## Planned (Phase 1+)

```
backend/app/
├── db/
│   ├── models.py       SQLModel: Listing, Artisan, Order
│   └── session.py      SQLite engine
├── data/
│   ├── gi_registry.json     ~200 real Indian GI crafts
│   └── comparables.json     category price bands for grounded pricing
└── routes/
    ├── storefront.py   GET /p/{id}  → server-rendered public product page
    └── qr.py           GET /api/qr/{id} → PNG QR code
```

**Storefront URL derivation:** `PUBLIC_BASE_URL` if set, otherwise built from
the incoming request's `Host` header. This is what makes a QR code scanned by a
judge's phone resolve to the laptop over a hotspot — a hardcoded `localhost`
would be unreachable from any other device.
