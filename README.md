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
| 🎙️ | **Voice** | Listens in Hindi / Kannada / English. No typing, no forms, no English required |
| 🤖 | **Listing** | Writes title, description, material, category, technique, dimensions and search tags — **in all three languages at once** |
| 💰 | **Fair price** | Suggests a price **and explains why**: materials, labour, skill premium, market position. The artisan can argue with the reasoning |
| 🚀 | **Publish** | Emits a real **ONDC RET10** catalog payload + a shareable WhatsApp link |

**Result:** an artisan who has never typed a word of English is sellable
nationwide, in about ninety seconds.

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

The frontend is wrapped with Capacitor, so there's a real native Android project.

```bash
make android      # build web assets → sync → open Android Studio
make apk          # build a shareable debug APK
```

| Setup | Backend URL |
|---|---|
| Emulator | `http://10.0.2.2:8000` (the app's default — `localhost` won't work) |
| Real device | `http://<laptop-LAN-IP>:8000` — get it with `make ip` |

```js
// point the app at your laptop, from the device console
localStorage.setItem('karigar_api_base', 'http://192.168.1.42:8000')
```

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
│   POST /api/generate-listing → Gemini vision (3 langs)   │
│   POST /api/price            → Gemini + fair-price rules │
│   POST /api/publish          → ONDC:RET10 catalog        │
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
│   │   ├── mock_data.py      keyword-aware offline AI
│   │   └── services/         gemini · image · pricing · ondc
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
| Multilingual listing generation | ✅ Real (Gemini vision, en/hi/kn) |
| Voice input | ✅ Real (Web Speech + native Android) |
| Offline mock fallback | ✅ Real, and genuinely tested |
| Price reasoning | ⚠️ Real LLM call — **not yet grounded in market data** |
| ONDC catalog | ⚠️ **Schema-correct payload, not yet POSTed to a live BPP.** Registration is an organisational step, not a technical one |
| GI-tag detection | ⚠️ LLM guess; registry verification planned |
| Persistence + public storefront | 🔜 Phase 1, in progress |

We do **not** claim to be live on ONDC. See [docs/ROADMAP.md](docs/ROADMAP.md).

---

## Why this wins

| Judge criterion | Our answer |
|---|---|
| **Real need** | 7M+ artisans; middlemen take up to 60%. The barrier is photography, language and pricing — not craft quality |
| **Clear government buyer** | Development Commissioner (Handicrafts), Ministry of Textiles, Ministry of MSME, **ONDC** |
| **Differentiation** | Voice-first, native-language, **seller-side** AI + open-network distribution |
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
make doctor    # diagnose a broken setup
make demo      # demo-day checklist + your LAN IP
```

**Two rules:** `main` is always demoable, and **never commit an API key.**

---

<div align="center">

Built for **Smart India Hackathon 2026** 🇮🇳

*Solving the seller-side problem that keeps 7 million artisans out of e-commerce.*

</div>
