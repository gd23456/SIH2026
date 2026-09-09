# Roadmap

Ordered by **judge-visible impact per hour of work**. Build top-down.

---

## ✅ Phase 0 — Foundation (done)

- [x] Repo on GitHub, history preserved, everything backed up
- [x] Python 3.11 pinned; heavy AI deps split out so setup never hard-fails
- [x] `make setup` / `make backend` / `make frontend` / `make doctor`
- [x] CI: backend lint + tests, frontend build, **secret scan**
- [x] 11 backend tests covering all 4 endpoints (run in mock mode)
- [x] Gemini model fallback chain — a stale model name can't kill the live demo
- [x] PR template, issue templates, CODEOWNERS, CONTRIBUTING
- [x] Docs: setup, architecture, demo script, team, judge Q&A

---

## 🔥 Phase 1 — Close the loop (do this next)

**The problem:** `publish` currently returns `https://karigar.ai/p/{id}`.
That domain does not exist. The demo ends on a dead link.

**The fix:** make it real, and put it on a judge's own phone.

| # | Task | Lane | Est |
|---|---|---|---|
| 1 | SQLite persistence (SQLModel): `Listing`, `Artisan` | Backend | 3h |
| 2 | `GET /p/{id}` — server-rendered public product page | Backend | 4h |
| 3 | Storefront URL derived from request host (**not** localhost) | Backend | 1h |
| 4 | `GET /api/qr/{id}` → QR PNG | Backend | 1h |
| 5 | QR code on the publish screen, large and scannable | Frontend | 2h |
| 6 | "My Products" dashboard — proves it's a product, not a script | Frontend | 4h |

**Done when:** a judge scans the QR with their own phone and sees the product
page for an item that didn't exist 90 seconds ago.

> This is the single highest-value thing left to build. Everything below is
> worth less than finishing this.

---

## 🎯 Phase 2 — Defensible differentiators

All four are approved for build. Ordered by how directly they answer a
question a judge will actually ask.

### 2A — Grounded Fair-Price engine · Lane: AI · ~8h
Answers *"how do you know ₹749 is fair?"* — the question we WILL be asked.

- [ ] Curate `comparables.json`: category → observed price bands (source from
      ONDC/Amazon/Etsy listings, cite the source count)
- [ ] Blend: LLM estimate × market band × labour-hours floor
- [ ] Add a **minimum fair wage floor** so the engine can never suggest a price
      below the artisan's labour cost — this is the social-impact argument
- [ ] UI: *"median ₹720 across 34 similar bamboo baskets"* beside the number

### 2B — Buyer-side ONDC view · Lane: Frontend · ~6h
Closes the story visually: seller → network → buyer, on one screen.

- [ ] `GET /api/search?q=` over published listings
- [ ] A mini "buyer app" screen with ONDC-ish chrome
- [ ] Demo beat: publish, then switch to buyer view and **find the item you
      just created**

### 2C — GI-tag verification · Lane: AI · ~5h
Ministry of Textiles judges will recognise this instantly.

- [ ] `gi_registry.json` — ~200 real Indian GI crafts (name, state, category)
- [ ] Fuzzy match listing → registry; verified match ≠ LLM guess
- [ ] Show a **verified GI badge** with the registry entry, and feed it into
      the price as a premium multiplier

### 2D — 6 more languages + offline PWA · Lane: i18n + Mobile · ~8h
Turns "a Karnataka app" into "a national solution."

- [ ] Tamil, Bengali, Marathi, Odia, Telugu, Gujarati in `i18n.js`
- [ ] Matching translations in `mock_data.py` and `LocalizedText`
- [ ] Service worker: app shell cached, works with no network
- [ ] Queue publishes made offline, sync when connectivity returns
- [ ] Low-bandwidth mode: aggressive image compression

---

## 🎬 Phase 3 — Submission (final 2 days: FEATURE FREEZE)

- [ ] Debug APK on GitHub Releases so anyone can install it
- [ ] Screenshots + GIF in the README
- [ ] 90-second demo video — **downloaded onto the presenting phone**
- [ ] Pitch deck (12 slides max)
- [ ] Judge Q&A rehearsal — see [JUDGE_QA.md](JUDGE_QA.md)
- [ ] Rehearse the live demo **at least 5 times, out loud, on the real device**
- [ ] Full flow tested on a genuinely cheap Android phone on 3G

---

## 🚀 Post-hackathon (the roadmap slide)

Distribution, not features — this is the startup argument.

- ONDC BPP registration → actually live on the network
- WhatsApp Business ordering (the channel artisans really use)
- Inventory, orders, GST invoicing
- B2B buyer matching for bulk exporters
- Shipping integration (Delhivery / India Post)
- Artisan credit scoring from sales history → working-capital access
- SHG / co-operative onboarding via the Development Commissioner (Handicrafts)
  cluster network

**The pitch:** *"Shopify + ONDC for artisans, where the AI does the difficult
part."*

---

## Deferred — deliberately

- ☁️ **Cloud deployment.** Decided: laptop + hotspot for demo day. This makes
  Phase 1 task #3 (host-derived storefront URLs) **mandatory** — a hardcoded
  localhost URL is unreachable from a judge's phone. Revisit if we get a
  venue with reliable internet.
- Payments, real auth, multi-tenant seller accounts — out of scope for the
  hackathon, good roadmap-slide material.
