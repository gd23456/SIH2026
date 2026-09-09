# Contributing to Karigar AI

Six people, one repo, a hard deadline. These rules exist so we spend demo week
building instead of resolving merge conflicts.

---

## The one rule that matters

> **`main` must be demoable at all times.**

At any moment, any one of us should be able to clone `main`, run two commands,
and walk a judge through the full 5-step flow. If a change would break that,
it goes behind a branch until it doesn't.

---

## Getting started (5 minutes)

```bash
git clone https://github.com/gd23456/SIH2026.git
cd SIH2026
make setup          # venv + npm install + creates backend/.env
make backend        # terminal 1 → http://localhost:8000
make frontend       # terminal 2 → http://localhost:5173
```

No API key needed — the app runs on realistic mock AI out of the box.
Stuck? Run `make doctor`, then read [docs/SETUP.md](docs/SETUP.md).

---

## Branch + PR flow

```bash
git checkout main
git pull
git checkout -b <area>/<short-description>     # e.g. frontend/storefront-qr
# ...work...
make test && make lint
git push -u origin <your-branch>
gh pr create --fill
```

**Branch naming:** `backend/`, `ai/`, `frontend/`, `mobile/`, `i18n/`, `docs/`

**Rules:**
1. **Never push directly to `main`.** Always a PR.
2. **Keep PRs small.** Under ~300 lines. A big PR gets reviewed badly at 2am.
3. **One PR = one thing.** Don't sneak a refactor into a feature.
4. **Get one approval** before merging. Squash-merge to keep history readable.
5. **Stay in your lane.** Touching another work-stream's directory? Tag that
   owner in the PR. See [.github/CODEOWNERS](.github/CODEOWNERS).

---

## Who owns what

One owner per directory — this is what makes parallel work possible.
Full table in [docs/TEAM.md](docs/TEAM.md).

| Work-stream | Owns |
|---|---|
| Backend / API | `backend/app/main.py`, `db/`, `config.py`, `schemas.py`, CI |
| AI services | `backend/app/services/`, `backend/app/data/` |
| Frontend | `frontend/src/components/`, `App.jsx`, `index.css` |
| Mobile | `frontend/android/`, `capacitor.config.json`, `public/` |
| i18n + data + QA | `lib/i18n.js`, `mock_data.py`, `backend/tests/` |
| Docs + pitch | `docs/`, `README.md` |

---

## Before you open a PR

```bash
make test     # backend tests must pass
make lint     # ruff must be clean
```

Then, by hand:

- [ ] Run the **whole flow**: photo → voice → review → price → publish
- [ ] Run it again with `FORCE_MOCK=1` in `backend/.env` — **the mock path is
      our stage fallback and must never break**
- [ ] Frontend change? Attach a screenshot

CI runs the same checks plus a secret scan. Red CI blocks the merge.

---

## 🔐 Security — read this once, properly

We had one near-miss already. Take it seriously.

**Never commit:**
- `.env` files (only `.env.example`, which must stay empty of real values)
- API keys, tokens, or anything starting `AIza...` / `ghp_...`
- Android signing keystores (`*.jks`, `*.keystore`)
- `google-services.json` or service-account JSON

**Before every commit:** `git status` and look at what you're staging.
Never blind-run `git add -A` without reading the list first.

**If you commit a key by accident:** don't quietly force-push. Tell the group
immediately, **rotate the key** ([revoke here](https://aistudio.google.com/app/apikey)),
*then* we clean history together. A rotated key is a non-event. A live key in a
public repo is a submission-ending problem.

**Also:** make sure you're in the right repo before running git commands.
`git rev-parse --show-toplevel` should print your `SIH2026` path — if it prints
your home directory, stop and ask.

---

## Commit messages

Short, imperative, prefixed with the area:

```
backend: add SQLite persistence for listings
frontend: show QR code on publish screen
ai: ground fair-price against comparables dataset
docs: add judge Q&A prep
fix: handle missing image in listing generation
```

---

## Code style

**Python** — ruff enforces it (`make lint`). Type hints on function signatures.
Docstrings on modules and non-obvious functions. Every AI call needs a mock
fallback; nothing may raise into the demo path.

**JavaScript / React** — functional components with hooks. Tailwind for styling,
no CSS modules. Every user-facing string goes through `t()` in `lib/i18n.js` —
**never hardcode English into a component.**

---

## Adding a language

1. Add the language to `LANGS` in `frontend/src/lib/i18n.js` (with its
   BCP-47 `speech` code, e.g. `ta-IN`)
2. Add the translation for **every** key in `STR`
3. Add the key to `LocalizedText` in `backend/app/schemas.py`
4. Add translations to the craft entries in `backend/app/mock_data.py`
5. Test the speech recognition on a real Android device — browser support and
   on-device support differ

---

## Questions

Ask in the group before building something big. Ten minutes of "should this be
a separate screen?" saves a day of rework.
