<div align="center">

# 🧺 Karigar AI

### Your voice. Your craft. A national storefront.

**An AI co-seller for India's 7 million artisans.**
One photo. One sentence, spoken in your own language. A live product listing on ONDC.

[![CI](https://github.com/gd23456/SIH2026/actions/workflows/ci.yml/badge.svg)](https://github.com/gd23456/SIH2026/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-8B5E3C.svg)](LICENSE)
[![Python 3.11](https://img.shields.io/badge/python-3.11-3776AB.svg)](https://www.python.org/)
[![React 18](https://img.shields.io/badge/react-18-61DAFB.svg)](https://react.dev/)
[![Works offline](https://img.shields.io/badge/demo-works%20offline-2E7D32.svg)](docs/SETUP.md)

**Smart India Hackathon 2026 · Problem Statement SIH26090**
*AI-Driven Market Linkage & Smart Cataloging Mobile Application for Marginalized Artisans*

</div>

---

## The problem

India has around **7 million artisans**. Almost none of them sell online.

Not because the craft isn't good enough — because selling online demands three
things they were never given: **product photography**, **English copywriting**,
and **market pricing knowledge**. So a middleman handles it, and takes up to
**60%** of what the work is worth.

Every existing solution builds another *marketplace* — solving the **buyer**
side, for sellers who can already list. Karigar AI solves the **seller** side:
the reason an artisan can't get onto a marketplace in the first place.

---

## What it does

An artisan takes **one photo** and **speaks one sentence** in their own
language. Karigar AI does the rest.

| | Step | What the AI does |
|---|---|---|
| 📷 | **Photo** | Removes the cluttered background, composites onto a studio backdrop, corrects lighting — a catalog-grade shot from a workshop phone snap |
| 🎙️ | **Voice** | Listens in **9 Indian languages**. No typing, no forms, no English required |
| 🤖 | **Listing** | Writes title, description, material, category, technique, dimensions and search tags — always in English + Hindi + Kannada, plus the artisan's own language. Speak it, **or let AI draft the whole listing from the photo alone** (Gemini vision) |
| ✓ | **Verified GI** | Matches the craft against the real **Geographical Indication registry** (~160 registered GIs). A verified match ≠ an LLM guess — it earns a green badge and a price premium |
| 💰 | **Fair price** | A **grounded** number: a market median from comparable listings, a skill premium, and a **fair-wage floor** it can never price below. Shows every line so the artisan can argue with it |
| 🚀 | **Publish everywhere** | **Publish once, reach every channel.** Real **ONDC RET10** catalog + QR storefront and a real **Shopify** product (Admin API); other channels are clearly-labelled demo adapters |
| 🛒 | **Buyer view** | The other side of the network: search the published catalogue and find the item the artisan just created |
| 👤 | **Account** | Google or phone-OTP sign-in (Firebase), a profile with connected channels + plan, and a "Skip for now (demo)" path that never blocks the demo |

**Result:** an artisan who has never typed a word of English is sellable
nationwide, in about ninety seconds.

<!-- TODO(demo): drop the 90-second demo GIF here before submission -->
<!-- ![Karigar AI — 90-second flow](docs/assets/demo.gif) -->

> 📸 **Screenshots & demo GIF:** _coming before submission_ — place them under
> `docs/assets/` and link them here (Welcome · Photo before/after · Listing in
> 3 scripts · Verified GI badge · Grounded price · QR storefront · Buyer view).

### Phase 2 — defensible differentiators

| Feature | Why it matters | Offline? |
|---|---|---|
| **Grounded fair-price engine** | Answers *"how do you know that price is fair?"* — market median × skill premium × a fair-wage floor that protects the artisan's labour cost | ✅ |
| **Registry-verified GI tags** | ~160 real Indian GIs; a *verified* Channapatna/Mysore-silk badge the Ministry of Textiles recognises, plus a documented +15% premium | ✅ |
| **Buyer-side ONDC view** | Closes the story visually: seller → network → buyer, on one phone | ✅ |
| **9 languages + offline PWA** | Tamil, Telugu, Bengali, Marathi, Gujarati, Odia on top of en/hi/kn; the app shell is precached and opens with no network | ✅ |

---

## Try it in 60 seconds

**No API key required.** The app ships with realistic, keyword-aware mock AI so
it works offline, on any laptop, immediately.

```bash
git clone https://github.com/gd23456/SIH2026.git
cd SIH2026
make setup

make backend     # terminal 1 → http://localhost:8000
make frontend    # terminal 2 → http://localhost:5173
```

Open <http://localhost:5173> and run the full flow.

<details>
<summary><b>Prefer manual setup, or on Windows?</b></summary>

```bash
# Backend
cd backend
python3.11 -m venv .venv && source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp ../.env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Optional — true neural background removal (needs Python 3.11):
```bash
pip install -r backend/requirements-ai.txt      # or: make setup-ai
```
</details>

Something wrong? Run **`make doctor`**, then see [docs/SETUP.md](docs/SETUP.md).

---

## Run on Android 🤖

`frontend/android/` is a real native Android project — it opens in Android
Studio, has its own manifest and `MainActivity`, and uses the native
`SpeechRecognizer`. It renders the built web app, so **the build order matters**:

```bash
cd frontend
npm run build && npx cap sync android    # ← sync is the step everyone forgets
cd android && ./gradlew assembleDebug
```

📖 **[docs/BUILD_ORDER.md](docs/BUILD_ORDER.md) — read this first.** Exact
versions, verification after every stage, and how to get a phone talking to
your laptop.

| Setup | Backend URL |
|---|---|
| Emulator | `http://10.0.2.2:8000` (automatic) |
| Real device | `http://<laptop-LAN-IP>:8000` — set it in-app: **⚙︎ Connection** |

The Connection screen tests the address and tells you whether the phone can
actually see the laptop. It also carries the offline-demo switch, so neither
needs a JS console any more.

Native voice uses `@capacitor-community/speech-recognition`; grant the mic
permission on first use.

---

## Why the demo never breaks

A hackathon demo runs on venue wifi, a free API tier and a borrowed phone.
We assumed all three would fail, and built three independent fallback layers:

```
Frontend   network failure  → client-side canned data   (karigar_demo=1)
Backend    no key / quota / parse error → keyword-aware mock AI   (FORCE_MOCK=1)
Service    rembg missing    → studio lighting instead of cutout
```

You can **unplug the network, delete the API key, and uninstall rembg** — the
full 5-step flow still completes. The mock is keyword-aware, not random: it
reads the artisan's words and produces a matching, plausible listing.

Check which mode you're in at any time:

```bash
curl http://localhost:8000/api/health
# {"status":"ok","mode":"mock","model":"mock","configured_model":"gemini-2.5-flash"}
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  ARTISAN'S PHONE — React 18 PWA · Capacitor 6 · Tailwind │
│  Welcome → Photo → Voice → Review → Price → Publish      │
└──────────────────────┬───────────────────────────────────┘
                       │ REST / JSON
┌──────────────────────▼───────────────────────────────────┐
│  FastAPI backend                                         │
│   POST /api/enhance-image    → rembg U²-Net + PIL        │
│   POST /api/generate-listing → Gemini vision + GI verify │
│   POST /api/price            → grounded fair-price engine│
│   POST /api/publish          → ONDC:RET10 + saved to db  │
│   GET  /api/listings         → the artisan's catalogue   │
│   GET  /api/search?q=        → buyer-side catalogue search│
│   GET  /p/{id}               → public storefront page    │
│   GET  /api/qr/{id}          → QR PNG for that page      │
│   GET  /api/health           → which mode am I in?       │
└──────────────────────────────────────────────────────────┘
```

**Stack:** React 18 · Vite · Tailwind · Capacitor 6 · Web Speech API ·
FastAPI · Pydantic v2 · Google Gemini · rembg (U²-Net) · Pillow

Full detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

---

## Project layout

```
├── backend/                  FastAPI + AI services
│   ├── app/
│   │   ├── main.py           routes
│   │   ├── config.py         env settings, mock/live decision
│   │   ├── schemas.py        Pydantic contracts
│   │   ├── mock_data.py      keyword-aware offline AI (9 languages)
│   │   ├── data/             comparables.json · gi_registry.json
│   │   ├── db/               SQLModel tables + repository
│   │   ├── templates/        server-rendered storefront page
│   │   └── services/         gemini · image · pricing · gi · ondc · channels
│   ├── scripts/seed_demo.py  stock the shelf for a live demo
│   ├── tests/                API contract tests (run in mock mode)
│   ├── requirements.txt      core — always installs cleanly
│   └── requirements-ai.txt   optional heavy vision deps
├── frontend/                 React PWA
│   ├── src/components/       the 5 steps
│   ├── src/lib/              api · i18n · speech · demoData
│   └── android/              Capacitor native project
├── docs/                     setup · architecture · demo · roadmap · judge Q&A
└── Makefile                  make setup / backend / frontend / doctor / demo
```

---

## Honest status

We'd rather be precise than impressive. This matters when the panel includes
ONDC and Ministry of Textiles people.

| Component | Status |
|---|---|
| Background removal + studio lighting | ✅ Real (rembg U²-Net) |
| Multilingual listing generation | ✅ Real (Gemini vision) — **9 languages** |
| Voice input | ✅ Real (Web Speech + native Android) |
| Offline mock fallback + PWA shell | ✅ Real, and genuinely tested |
| Grounded fair-price engine | ✅ Real — market comparables + skill premium + **fair-wage floor**; every signal shown |
| GI-tag verification | ✅ Real — fuzzy-matched against a **~160-entry registered-GI registry** (distinct from the LLM guess), feeds a +15% premium |
| Buyer-side ONDC search | ✅ Real (`GET /api/search`, buyer view screen) |
| Accounts (Google + phone OTP) | ✅ Real via Firebase Web SDK; **demo-account fallback** so it never blocks |
| Multi-channel publish | ✅ **ONDC + Shopify are real live channels** (Shopify via the Admin API when a store is configured). Meesho/Myntra/Amazon/Flipkart/WhatsApp are clearly-labelled demo adapters (no public seller API, no credential capture) |
| Plans / paid upgrade | ⚠️ Plan flag + Pro screen real; **live Google Play Billing is post-hackathon** (no fake payment) |
| ONDC catalog | ⚠️ **Schema-correct payload, not yet POSTed to a live BPP.** Registration is an organisational step, not a technical one |
| Persistence + public storefront | ✅ Real (SQLite; `GET /p/{id}` + QR, served offline over the laptop hotspot) |

We do **not** claim to be live on ONDC. See [docs/ROADMAP.md](docs/ROADMAP.md).

### Roadmap to production

Explicit about what's real today vs what's next — because the panel will ask.

| Live now | Simulated (honestly labelled) | Post-hackathon |
|---|---|---|
| **ONDC** catalog + QR storefront and **Shopify** (real product via the Admin API); offline PWA, 9-language voice→listing, grounded pricing, GI verification, buyer search, Google/phone sign-in | Meesho / Myntra / Amazon Karigar / Flipkart Samarth / WhatsApp "connect" + publish (demo adapters — **no credential capture, no fake logins**) | ONDC BPP registration (go live); real seller-API integrations as each marketplace grants access; **Google Play Billing** for Karigar Pro; signed Play Store release |

**ONDC and Shopify are real, end-to-end live channels** (Shopify creates an
actual product on a configured store). The other marketplaces don't offer a
public API to link a seller by phone and cross-post, so we built those as
transparent demo adapters rather than faking a login.

---

## Why this wins

| Judge criterion | Our answer |
|---|---|
| **Real need** | 7M+ artisans; middlemen take up to 60%. The barrier is photography, language and pricing — not craft quality |
| **Clear government buyer** | Development Commissioner (Handicrafts), Ministry of Textiles, Ministry of MSME, **ONDC** |
| **Differentiation** | Voice-first, 9-language, **seller-side** AI · grounded fair pricing · registry-verified GI · buyer-side ONDC view — all working offline |
| **Social impact** | The price engine has a **labour-cost floor** — it cannot suggest a price below what the artisan's time is worth |
| **Buildable** | Runs today, on a laptop, with no API key |
| **Startup potential** | *"Shopify + ONDC for artisans, where the AI does the difficult part"* |

---

## For the team

| Doc | What's in it |
|---|---|

| [CONTRIBUTING.md](CONTRIBUTING.md) | Branch flow, PR rules, **security rules** |
| [docs/SETUP.md](docs/SETUP.md) | Every failure mode and its fix |
| [docs/TEAM.md](docs/TEAM.md) | Who owns which directory |
| [docs/ROADMAP.md](docs/ROADMAP.md) | What to build next, in priority order |
| [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) | The 90-second script + fallbacks |
| [docs/JUDGE_QA.md](docs/JUDGE_QA.md) | Every question we'll get, with answers |

```bash
make help      # all available commands
make doctor    # diagnose setup + ping every live integration (Gemini/Shopify)
make demo      # demo-day checklist + your LAN IP
```

> `make doctor` (or `python backend/scripts/doctor.py`) reports which
> integrations are live vs mock — the same status is on `GET /api/health`.

**Two rules:** `main` is always demoable, and **never commit an API key.**

---

<div align="center">

Built for **Smart India Hackathon 2026** 🇮🇳

*Solving the seller-side problem that keeps 7 million artisans out of e-commerce.*

</div>
