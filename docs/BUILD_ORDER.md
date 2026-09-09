# Build Order

> ### ⚠️ Status: ahead of `main`
>
> This document describes the build as it works **once the Phase 1 branches
> merge**. Sections marked 🔀 do not work on `main` yet.
>
> | Branch | Unlocks |
> |---|---|
> | `backend/phase1-storefront` | persistence, `GET /p/{id}` storefront, QR endpoint |
> | `frontend/publish-qr-and-my-products` | QR on the publish screen, My Products |
> | `mobile/android-build` | the Android build itself, and the ⚙︎ Connection screen |
>
> Merge in that order — they are stacked. Stages 1 and 2 below are accurate
> against `main` today; stages 3 and 4 are not.
>
> On `main` right now, `./gradlew assembleDebug` fails on any JDK newer than 20,
> and the APK cannot reach the backend even if you force it to build.

**Read this top to bottom the first time. The order matters — each stage is
verified before the next one depends on it.**

Karigar AI is three things that must be built in sequence:

```
1. BACKEND        FastAPI + SQLite          →  http://<laptop>:8000
        │              serves the API, the storefront page and the QR
        ▼
2. WEB APP        React + Vite              →  http://localhost:5173
        │              the five-step artisan flow; talks to (1)
        ▼
3. ANDROID APP    Capacitor + Gradle        →  app-debug.apk
                       wraps (2) in a native shell; still talks to (1)
```

The Android app is **not** a separate codebase. `frontend/android/` is a real
native Android project — it opens in Android Studio, has its own
`AndroidManifest.xml` and `MainActivity`, and uses the native
`SpeechRecognizer` for voice. What it renders is the built web app from stage 2.
So **stage 3 can never be newer than stage 2**: every UI change needs a
`npm run build && npx cap sync android` before it exists in the APK.

---

## 0. Prerequisites

Install these first. Versions are not suggestions — the wrong ones fail in
confusing ways.

| Tool | Version | Why exactly this |
|---|---|---|
| Python | **3.11** | `onnxruntime` (for `rembg`) publishes no wheels for 3.12+. The core app runs on newer, the optional vision deps do not. |
| Node.js | **20+** | Vite 5. |
| JDK | **17 or 21** | Gradle 8.9 runs on JDK 8–21. **JDK 22+ fails.** Android Studio bundles a JBR 21 — use that and you need no separate install. |
| Android SDK | **Platform 34**, build-tools **34.0.0** | `compileSdk`/`targetSdk` are 34. |
| Android Studio | Latest | Only needed for the emulator, the SDK manager and on-device debugging. The APK itself builds from the command line. |

> **Windows note:** the `Makefile` does not work on Windows. `make` is usually
> absent, and its targets hardcode POSIX venv paths (`backend/.venv/bin/pip`)
> that do not exist — Windows venvs use `Scripts/`. Every `make` command below
> has a spelled-out equivalent. Use those.

Check what you have:

```bash
python --version      # or: py -0p   (Windows, lists all installed)
node --version
java -version
```

---

## 1. Backend

Nothing else works until this does.

```bash
git clone https://github.com/gd23456/SIH2026.git
cd SIH2026
```

**macOS / Linux**

```bash
make setup-backend
make backend
```

**Windows** (or any machine without `make`)

```bash
py -3.11 -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install --upgrade pip
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements-dev.txt
cp .env.example backend/.env

backend/.venv/Scripts/python.exe -m uvicorn app.main:app \
    --host 0.0.0.0 --port 8000 --app-dir backend
```

`--host 0.0.0.0` is not optional. Bound to `127.0.0.1` the server is invisible
to your phone.

### ✅ Verify before continuing

```bash
curl http://localhost:8000/api/health
# {"status":"ok","mode":"mock","model":"mock","configured_model":"gemini-2.5-flash"}
```

`"mode":"mock"` is correct and expected with no API key. It means realistic
canned AI, and the whole flow works this way.

Optional — real background removal (needs Python 3.11):

```bash
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements-ai.txt
```

First photo then downloads ~180MB of model weights. **Do that on good wifi
before demo day, not at the venue.**

---

## 2. Web app

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

### ✅ Verify before continuing

Open <http://localhost:5173> and complete the whole flow: photo → voice →
review → price → publish.

🔀 Once the Phase 1 branches land, the publish screen must also end on a **QR
code** and a working storefront link. On `main` today it ends on a WhatsApp
share link pointing at `karigar.ai`, which is not a real domain.

---

## 3. Android app 🔀

### 3a. Point Gradle at your SDK

Create `frontend/android/local.properties` (gitignored — machine-specific):

```properties
sdk.dir=C:/Users/<you>/AppData/Local/Android/Sdk
```

macOS: `/Users/<you>/Library/Android/sdk` · Linux: `/home/<you>/Android/Sdk`

### 3b. Use a JDK Gradle accepts

If `java -version` says 22 or newer, point this build at Android Studio's
bundled JBR instead of installing anything:

```bash
# Windows
export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr"
# macOS
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
```

### 3c. Build the web assets, then sync, then compile

**This order is the whole point of this document.**

```bash
cd frontend
npm run build            # produces dist/
npx cap sync android     # copies dist/ into the native project + wires plugins
cd android
./gradlew assembleDebug
```

`npx cap sync` is the step everyone forgets. Skip it and you will build an APK
containing whatever the web app looked like the *last* time someone synced, and
spend an hour wondering why your change isn't there.

### ✅ Verify

```
frontend/android/app/build/outputs/apk/debug/app-debug.apk    (~3.8 MB)
```

Install it:

```bash
adb install -r frontend/android/app/build/outputs/apk/debug/app-debug.apk
```

Or open the project in Android Studio (`npx cap open android`) and press Run.

---

## 4. Connect the phone to the backend 🔀

**This is the step that breaks demos.** The app and the backend are on two
different machines.

| Where the app runs | Backend address to use |
|---|---|
| Browser on the laptop | `http://localhost:8000` (automatic) |
| Android **emulator** | `http://10.0.2.2:8000` (automatic — `10.0.2.2` is the emulator's alias for the host) |
| **Real phone** | `http://<your-laptop's-LAN-IP>:8000` — **you must set this** |

Find your laptop's address:

```bash
# Windows
ipconfig | findstr IPv4
# macOS
ipconfig getifaddr en0
# Linux
hostname -I
```

Then, **in the app**: Welcome screen → **⚙︎ Connection** → type
`http://192.168.x.x:8000` → **Test connection** → **Save**.

The sheet tells you whether the phone can actually see the laptop, and which
mode the backend is in. Do not skip the test — a green *Connected* here is the
single best predictor that the demo will work.

> Use **your own phone's hotspot**, with the laptop joined to it. Venue and
> campus wifi almost always have client isolation, which silently blocks
> phone→laptop traffic even though both have internet.

### If it says unreachable

1. Both devices on the same hotspot?
2. Backend started with `--host 0.0.0.0`?
3. Windows Firewall prompting for Python? Allow it on private networks.
4. Open `http://<LAN-IP>:8000/api/health` in the **phone's browser**. Works
   there but not in the app → tell the team; it's an app bug, not networking.

Last resort: the same sheet has an **Offline demo data** switch. The whole
five-step flow then runs on canned data with no server at all. The QR and
storefront are the only things that need the backend.

---

## 5. Full verification

Tick all of these before you call a build good.

**Backend**

```bash
backend/.venv/Scripts/python.exe -m pytest backend/tests    # all pass
backend/.venv/Scripts/python.exe -m ruff check backend/app backend/tests
curl http://localhost:8000/api/health
```

**Web**

```bash
cd frontend && npm run build      # must succeed; CI runs exactly this
```

**End to end, on the phone** 🔀 *(needs all three Phase 1 branches)*

- [ ] ⚙︎ Connection shows **Connected**
- [ ] Photo → background removed, studio-lit
- [ ] Voice → mic permission prompt appears, listing generated in your language
- [ ] Price → a number with a breakdown that sums to it
- [ ] Publish → QR appears
- [ ] **Scan that QR with a second phone** → the product page loads
- [ ] My Products → the item you just made is listed
- [ ] Kill the backend, restart it, reload the product page → still there

---

## Demo-day runbook

1. Phone hotspot on. Laptop joined to it. **Not venue wifi.**
2. Start the backend. Leave it running.
3. Note the laptop's LAN IP.
4. On the demo phone: ⚙︎ Connection → set the IP → Test → green. 🔀
5. Load one photo through the flow *before* the judges arrive, so the rembg
   model weights are cached and the first real photo is fast.
6. If the network is flaky: set `FORCE_MOCK=1` in `backend/.env` and restart —
   no API calls, instant responses, identical UI.
7. If everything falls over: ⚙︎ Connection → **Offline demo data**. 🔀
   On `main` today this is console-only:
   `localStorage.setItem('karigar_demo','1')`

Full script: [DEMO_SCRIPT.md](DEMO_SCRIPT.md)

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `make: command not found` | Windows | Use the spelled-out commands above |
| `Unsupported class file major version` | JDK 22+ | §3b — use JBR 21 |
| `SDK location not found` | no `local.properties` | §3a |
| APK missing your latest UI change | forgot `npx cap sync` | §3c |
| App loads but every screen is canned data | can't reach the backend | §4 — on `main` the APK *always* does this, see below |
| `pip install` fails on `onnxruntime` | Python ≠ 3.11 | Skip `requirements-ai.txt`; the app degrades gracefully |
| First photo takes 30+ seconds | downloading model weights | One-time; do it before demo day |
| White screen for seconds on launch | render-blocking Google Fonts fetch with no internet | 🔀 fixed in `mobile/android-build` |

More: [SETUP.md](SETUP.md)

---

## Why the Android app needs cleartext 🔀

On `mobile/android-build`, `AndroidManifest.xml` sets
`android:usesCleartextTraffic="true"` and `capacitor.config.json` sets
`android.allowMixedContent`. **Neither is set on `main`.** Both are deliberate,
and both are required:

- Android blocks cleartext HTTP by default from API 28. `targetSdk` is 34, and
  the backend is a laptop on `http://` with no TLS certificate.
- The WebView origin is `https://localhost`, so an `http://` fetch from it is
  *mixed content*, which is blocked separately.

Without **both**, the APK cannot reach the backend at all — not on a device and
not on the emulator. Revisit them if this is ever deployed behind a real HTTPS
domain.
