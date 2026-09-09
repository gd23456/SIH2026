<!--
Keep PRs SMALL. A 200-line PR gets reviewed in 5 minutes.
A 2000-line PR gets reviewed the night before submission, badly.
-->

## What does this change?

<!-- One or two sentences. -->

## Which work-stream is this?

<!-- Tick one. See docs/TEAM.md -->

- [ ] Backend / API
- [ ] AI services (Gemini, prompts, pricing, GI)
- [ ] Frontend / UX
- [ ] Mobile (Capacitor / Android)
- [ ] i18n, data, QA
- [ ] Docs / pitch

## Demo impact

<!-- Does a judge SEE this? If yes, say what changes on screen. -->

## Checklist

- [ ] `make test` passes locally
- [ ] `make lint` passes locally
- [ ] I ran the **full 5-step flow** (photo → voice → review → price → publish) and it still works
- [ ] It still works in **mock mode** (`FORCE_MOCK=1`) — our stage fallback must never break
- [ ] **No API keys, `.env` files, or keystores** in this diff
- [ ] I only touched files my work-stream owns, or I flagged the owner below

## Screenshots / recording

<!-- Frontend changes: drop a screenshot or a short screen recording. -->

## Anything the reviewer should watch out for?
