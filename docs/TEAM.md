# Team & Work-streams

Six people. The split below is **by directory**, so two people almost never
edit the same file. That is the entire point.

Lanes below reflect where people have actually been working, not a plan drawn
up in advance. [`.github/CODEOWNERS`](../.github/CODEOWNERS) matches this table
and auto-requests the right reviewers on every PR.

---

## The lanes

| # | Lane | Owner | GitHub | Owns these paths |
|---|---|---|---|---|
| 1 | **Lead / Backend** | Gourab | `@gd23456` | `backend/app/main.py`, `app/db/`, `config.py`, `schemas.py`, `.github/`, `Makefile` |
| 2 | **Backend / AI Services** | Saatwik | `@skypank-coder` | `backend/app/services/`, `backend/app/data/`, `backend/tests/` |
| 3 | **Frontend / Mobile** | Priyanshu | `@Priyanshu-senapati` | `frontend/src/components/`, `frontend/src/lib/`, `frontend/android/`, `capacitor.config.json` |
| 4 | **i18n / Data / Docs** | Rachana | `@RachanaB5` | `frontend/src/lib/i18n.js`, `backend/app/data/`, `docs/`, `README.md` |

> `disnithaa` has been invited but has **not accepted yet** — until they do,
> they cannot push. Check github.com/gd23456/SIH2026/invitations.

## Reviewing

`main` requires **1 approval**, and every collaborator has write access, which
is all GitHub needs to approve a PR. So any teammate can unblock any PR — you
do not have to wait for the repo owner.

**You cannot approve your own PR.** That is why CODEOWNERS lists the whole team
on the default line: whoever opens a PR, the other three still get asked.

**Three of us have Claude Code** — those should be lanes **1, 2, and 3**
(backend, AI, frontend). Those lanes carry the most code volume, so the
tooling advantage goes furthest there.

---

## What each lane actually does

### 1 — Lead / Backend
Owns `main`, CI, and the merge queue. Reviews every PR. Builds SQLite
persistence, the public storefront route, and the QR endpoint. **Also owns
the rule that `main` stays demoable** — if CI is red, this person's job is to
get it green before anything else merges.

### 2 — AI Services
Prompt engineering, the Gemini fallback chain, the **grounded fair-price
engine** (comparables dataset, not a bare LLM guess), and **GI-tag
verification** against a real registry dataset. This lane owns the answer to
the hardest judge question we'll get: *"how do you know that price is right?"*

### 3 — Frontend
The 5-step flow, plus the new screens: **QR + storefront**, **My Products**
dashboard, and the **buyer-side ONDC view**. Owns whether the demo *feels*
good — which is most of the score.

### 4 — Mobile
Capacitor/Android, native speech recognition, the offline PWA + low-bandwidth
mode, and shipping a **debug APK to GitHub Releases** so the whole team can
install it on real phones. Owns "it works on an actual cheap Android phone."

### 5 — i18n / Data / QA
Expands 3 languages → 9 (ta, bn, mr, or, te, gu), curates the GI registry and
comparables datasets, and does **the QA pass nobody else will do**: run the
full flow on a real device, on a bad network, in every mode, every single day.

### 6 — Pitch / Docs
The deck, the 90-second video, screenshots, the judge Q&A prep doc, and the
submission paperwork. **Start day one, not the night before.** This lane
decides how the other five lanes' work gets *perceived*.

---

## Working agreements

1. **`main` is always demoable.** Non-negotiable.
2. **Never push to `main`.** PR + one approval, always.
3. **Small PRs.** Under ~300 lines.
4. **Stay in your lane.** Need a file you don't own? Tag the owner.
5. **Daily 10-minute standup.** What I did / what I'm doing / what's blocking.
6. **Demo from `main` every single day.** Whoever is free runs the full flow
   end-to-end. The bug you find on day 3 is free; the one you find on stage
   is fatal.
7. **Ask early.** Ten minutes of "should this be a separate screen?" beats a
   day of rework.

---

## Rhythm

| When | What |
|---|---|
| Every morning | 10-min standup; assign issues from the board |
| Every evening | Someone demos `main` end-to-end on a real phone |
| Twice a week | Review the roadmap: are we building judge-visible things? |
| Final 2 days | **Feature freeze.** Only bug fixes, polish, deck, and rehearsal. |

**Rehearse the pitch out loud at least five times.** The demo is 90 seconds;
the difference between a team that has rehearsed and one that hasn't is
visible in the first ten.
