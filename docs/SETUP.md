# Setup & Troubleshooting

If you're stuck for more than 15 minutes, ask in the group. Don't burn an
evening on a dependency — the app is designed to work without the hard parts.

---

## The happy path

```bash
git clone https://github.com/gd23456/SIH2026.git
cd SIH2026
make setup
make backend     # terminal 1
make frontend    # terminal 2
```

Open <http://localhost:5173>. You should be able to complete the full flow
immediately — **no API key required.**

Verify the backend: <http://localhost:8000/api/health>

```json
{ "status": "ok", "mode": "mock", "model": "mock", "configured_model": "gemini-2.5-flash" }
```

`"mode": "mock"` is **normal and fine**. It means realistic canned AI.

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Python | **3.11** | Not 3.12+. See below. |
| Node.js | 20+ | |
| Java JDK | 17 | Android work only |
| Android Studio | Latest | Android work only |

### Why Python 3.11 specifically

`onnxruntime` (which `rembg` needs for background removal) does not publish
wheels for every new Python release the moment it lands. On a newer Python,
`pip install -r requirements-ai.txt` fails with a build error.

The core app doesn't care — that's why the heavy deps are in a separate file.
But if you want true background removal, use 3.11.

```bash
# macOS
brew install python@3.11

# Ubuntu / WSL
sudo apt install python3.11 python3.11-venv

# Windows — download 3.11 from python.org, then:
py -3.11 -m venv backend\.venv
```

`make setup-backend` prefers `python3.11` automatically if it's on your PATH.

---

## The three modes (understand these — they save you hours of confusion)

| Mode | How you get it | What happens |
|---|---|---|
| **Live** | `GEMINI_API_KEY` set in `backend/.env` | Real Gemini calls |
| **Mock** | No key, or `FORCE_MOCK=1` | Backend returns keyword-aware canned AI |
| **Demo** | `localStorage.setItem('karigar_demo','1')` | Frontend never calls the backend at all |

Layered on purpose: even if the backend is down *and* there's no key *and*
there's no wifi, the app still demos. **Demo mode is our stage insurance.**

---

## Seed demo data (so the shelf is never empty on stage)

"My Products" and the Buyer view read from the database. On a fresh clone they
start empty. Seed a few realistic listings — bamboo basket, Channapatna toys
(verified GI), Mysore silk (verified GI), terracotta vase — so both screens
have something to show before you publish live:

```bash
cd backend
python scripts/seed_demo.py           # add the demo listings
python scripts/seed_demo.py --reset   # wipe first, then add (idempotent re-seed)
```

It runs the same path a real publish does (mock listing → GI verification →
grounded fair-price → ONDC id) and writes straight to the app's database, so
no server needs to be running. Seed once, then start the backend and the
products are already there.

---

## Getting a Gemini key (optional)

1. <https://aistudio.google.com/app/apikey> → Create API key (free tier)
2. Paste into `backend/.env`: `GEMINI_API_KEY=AIza...`
3. Restart the backend
4. `/api/health` should now show `"mode": "live (Gemini)"`

⚠️ **Never commit this key.** `backend/.env` is gitignored — keep it that way.

If the configured model isn't available on your key, the backend automatically
walks down a fallback list (`gemini-2.5-flash` → `2.0-flash` → `1.5-flash`).
`/api/health` shows the model that actually answered.

---

## Troubleshooting

### `make doctor`

Run this first. It checks Python, the venv, node modules, `.env`, rembg,
and whether the API is up.

---

### `pip install` fails on onnxruntime / rembg

**Expected on Python ≠ 3.11. Just skip it.**

```bash
pip install -r backend/requirements.txt     # this is all you actually need
```

The app detects rembg is missing and studio-lights the whole photo instead of
cutting the object out. In a 90-second demo nobody notices.

---

### First image upload takes 30+ seconds

rembg is downloading ~180MB of U²-Net weights to `~/.u2net/`. One-time.

**Do this on good wifi before demo day.** Upload one photo the night before so
the weights are cached.

---

### Frontend loads but nothing happens / everything is canned

The frontend can't reach the backend, so it fell back to demo data. Check:

1. Is the backend running? `curl http://localhost:8000/api/health`
2. Is there a stale override? In the browser console:
   ```js
   localStorage.getItem('karigar_api_base')   // should be null for local dev
   localStorage.removeItem('karigar_api_base')
   localStorage.removeItem('karigar_demo')
   ```
3. Look for a **"demo"** badge in the app header — that's the app telling you
   it's on fallback data.

---

### The mic button doesn't appear

Web Speech API support is limited. Use **Chrome** on desktop. On Firefox/Safari
the mic is hidden and the text box is the input — that's intentional, not a bug.

On Android the app uses the native `SpeechRecognizer` instead, which needs the
`RECORD_AUDIO` permission granted on first use.

---

### CORS errors in the console

Add your origin to `CORS_ORIGINS` in `backend/.env` and restart. For LAN
testing, include your laptop's IP:

```
CORS_ORIGINS=http://localhost:5173,http://192.168.1.42:5173
```

---

### Android: app runs but can't reach the backend

| Setup | Backend URL |
|---|---|
| Emulator | `http://10.0.2.2:8000` (the app's default — `localhost` will NOT work) |
| Real device | `http://<your-laptop-LAN-IP>:8000` |

Get your LAN IP with `make ip`. Then in the app:

```js
localStorage.setItem('karigar_api_base', 'http://192.168.1.42:8000')
```

Or bake it in at build time:

```bash
cd frontend && VITE_API_BASE=http://192.168.1.42:8000 npm run build && npx cap sync android
```

**Both devices must be on the same network.** Most venue wifi has client
isolation enabled, which silently blocks this — use a phone hotspot.

---

### Building the Android app / a debug APK

The web build must be synced into the native project first:

```bash
cd frontend
npm run build          # emits dist/ + the PWA service worker
npx cap sync android   # copies dist/ into android/app/src/main/assets
npx cap open android   # open in Android Studio (Run ▶ to a device/emulator)
```

To produce a shareable **debug APK** without Android Studio:

```bash
cd frontend/android
./gradlew assembleDebug
# → app/build/outputs/apk/debug/app-debug.apk
```

Install it with `adb install app-debug.apk`, or attach it to a GitHub Release
so anyone can side-load it.

### Gradle build fails

```bash
cd frontend/android
./gradlew clean
cd ../.. && make android
```

Check Android Studio is using **JDK 17** (Settings → Build Tools → Gradle).

---

### Git says I'm in the wrong repository

```bash
git rev-parse --show-toplevel
```

This must print your `SIH2026` clone path. If it prints your home directory,
you have a stray `.git` in `~` — **stop and ask in the group before running any
git command.** Committing from a home-directory repo can publish your SSH keys.
