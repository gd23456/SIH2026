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

`onnxruntime` (which `rembg` needs for background removal) historically lagged
on brand-new Python releases. Recent onnxruntime (1.20+) now ships wheels for
3.11–3.13 — **true background removal is verified working on Python 3.13 with
onnxruntime 1.24** — but a very new release can still lag, in which case
`pip install -r requirements-ai.txt` fails with a build error.

The core app doesn't care — that's why the heavy deps are in a separate file.
If the AI install fails on your Python, fall back to 3.11; the studio-composite
path (white balance + clarity + unsharp) keeps working meanwhile.

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

## Accounts & sign-in (Firebase — optional)

The seller flow is gated by a login screen (Google or phone-OTP). **It is
optional for the demo:** with no Firebase config the app runs a local
**demo-account** mode, and **"Skip for now (demo)"** always works — a
login/Firebase misconfig can never block the stage demo.

To enable *real* sign-in, copy `frontend/.env.example` → `frontend/.env` and fill:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_APP_ID=1:...:web:...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
```

1. Create a project at <https://console.firebase.google.com>.
2. **Authentication → Sign-in method:** enable **Google** and **Phone**.
3. **Authentication → Settings → Authorized domains:** add every origin the app
   is served from — `localhost`, your laptop's LAN IP, and the Capacitor WebView
   origin **`localhost`** (Android renders at `https://localhost`). Google popup
   and phone-OTP reCAPTCHA are rejected from unlisted domains.
4. On Android we use the Firebase **Web** SDK inside the WebView (Google popup +
   phone OTP via reCAPTCHA) — **no** `google-services.json` / native plugin is
   required, so the build is never blocked on native Firebase wiring.

Values are read as `import.meta.env.VITE_FIREBASE_*`; `frontend/.env` is
gitignored — never commit real keys.

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

### `make doctor` / the integrations doctor

Run this first. It checks Python, the venv, node modules, `.env`, rembg, and
whether the API is up — then runs the **integrations doctor**, which reports
each live API (Gemini, rembg, Firebase) and does a one-call live ping of
Gemini, telling you OK or the exact reason it isn't live.

On Windows (no `make`), run it directly:

```bash
cd backend && python scripts/doctor.py
```

The same status is on `GET /api/health` under `integrations`.

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

### Signed release bundle (AAB) for the Play Store

Play Store uploads are **.aab**, signed with your own upload keystore. Live
Play Store publishing + Play Billing are a post-hackathon process; the steps:

```bash
# 1. Create an upload keystore once (keep the .jks + passwords safe, NEVER commit)
keytool -genkey -v -keystore karigar-upload.jks -keyalg RSA -keysize 2048 \
        -validity 10000 -alias karigar

# 2. Point Gradle at it (e.g. via ~/.gradle/gradle.properties or signingConfigs):
#    KARIGAR_STORE_FILE / KARIGAR_STORE_PASSWORD / KARIGAR_KEY_ALIAS / KARIGAR_KEY_PASSWORD

# 3. Bump the version in android/app/build.gradle for each release:
#    versionCode (integer, must increase) + versionName (e.g. "1.1.0")

# 4. Build the signed bundle
cd frontend
npm run build && npx cap sync android
cd android && ./gradlew bundleRelease
# → app/build/outputs/bundle/release/app-release.aab  → upload to Play Console
```

Keystores and `*.jks` are gitignored — never commit them. See
[docs/STORE_LISTING.md](STORE_LISTING.md) for the store copy + asset checklist,
and [docs/PRIVACY.md](PRIVACY.md) for the required privacy policy.

### App icon & splash

App name (`Karigar AI`) and id (`ai.karigar.app`) are set in
`frontend/capacitor.config.json` and `android/app/build.gradle`. To regenerate
launcher icons + splash from a source image:

```bash
# put a 1024×1024 PNG at frontend/assets/icon.png (or use public/icon.svg)
cd frontend && npx @capacitor/assets generate --android
```

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
