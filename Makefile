# ---------------------------------------------------------------------------
# Karigar AI — one-command developer setup
#
#   make setup     first time, sets up backend + frontend
#   make backend   run the API      (http://localhost:8000)
#   make frontend  run the web app  (http://localhost:5173)
#   make demo      print the exact demo-day checklist + your LAN IP
#
# Run `make` with no arguments to see everything.
# ---------------------------------------------------------------------------

SHELL := /bin/bash
PY    := $(shell command -v python3.11 2>/dev/null || command -v python3)
VENV  := backend/.venv
PIP   := $(VENV)/bin/pip
UVI   := $(VENV)/bin/uvicorn

.DEFAULT_GOAL := help
.PHONY: help setup setup-backend setup-frontend setup-ai backend frontend test lint android apk ip demo clean doctor

help: ## Show this help
	@echo ""
	@echo "  🧺 Karigar AI — make targets"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'
	@echo ""

# --- setup ----------------------------------------------------------------

setup: setup-backend setup-frontend ## Full first-time setup (backend + frontend)
	@echo ""
	@echo "✅ Setup complete. Now run 'make backend' and 'make frontend' in two terminals."
	@echo "   Optional (true background removal):  make setup-ai"

setup-backend: ## Create venv + install core backend deps
	@echo "🐍 Using $(PY) ($$($(PY) --version))"
	@$(PY) -c 'import sys; sys.exit(0 if sys.version_info[:2]==(3,11) else 1)' \
		|| echo "⚠️  Not Python 3.11 — core deps will still work, but 'make setup-ai' may fail. See docs/SETUP.md"
	$(PY) -m venv $(VENV)
	$(PIP) install --upgrade pip
	$(PIP) install -r backend/requirements.txt
	@test -f backend/.env || (cp .env.example backend/.env && echo "📝 Created backend/.env from template")
	@echo "✅ Backend ready (mock mode — add GEMINI_API_KEY to backend/.env for live AI)"

setup-ai: ## Optional: install rembg + onnxruntime for true background removal
	@echo "⬇️  Installing heavy AI vision deps (this may fail on Python != 3.11 — that's OK, see docs/SETUP.md)"
	-$(PIP) install -r backend/requirements-ai.txt
	@echo "ℹ️  First image will download ~180MB of model weights. Do this on good wifi."

setup-frontend: ## Install frontend npm packages
	cd frontend && npm install
	@echo "✅ Frontend ready"

# --- run ------------------------------------------------------------------

backend: ## Run the FastAPI backend on :8000 (reachable on your LAN)
	@echo "🚀 API on http://localhost:8000  ·  docs at /docs  ·  mode at /api/health"
	$(UVI) app.main:app --reload --host 0.0.0.0 --port 8000 --app-dir backend

frontend: ## Run the Vite dev server on :5173
	cd frontend && npm run dev

# --- quality --------------------------------------------------------------

test: ## Run backend tests
	$(VENV)/bin/pytest backend/tests -v

lint: ## Lint the backend
	$(VENV)/bin/ruff check backend/app backend/tests

doctor: ## Diagnose a broken setup
	@echo "python:   $$($(PY) --version 2>&1)"
	@echo "venv:     $$(test -d $(VENV) && echo present || echo MISSING — run 'make setup-backend')"
	@echo "node:     $$(node --version 2>&1)"
	@echo "npm mods: $$(test -d frontend/node_modules && echo present || echo MISSING — run 'make setup-frontend')"
	@echo "env file: $$(test -f backend/.env && echo present || echo MISSING — run 'cp .env.example backend/.env')"
	@echo "rembg:    $$($(VENV)/bin/python -c 'import rembg; print(\"installed\")' 2>/dev/null || echo 'not installed (fine — optional)')"
	@echo "API:      $$(curl -s -m 2 http://localhost:8000/api/health || echo 'not running')"

# --- android --------------------------------------------------------------

android: ## Build web assets, sync, and open Android Studio
	cd frontend && npm run build && npx cap sync android && npx cap open android

apk: ## Build a debug APK you can share with the team
	cd frontend && npm run build && npx cap sync android
	cd frontend/android && ./gradlew assembleDebug
	@echo "📦 APK: frontend/android/app/build/outputs/apk/debug/app-debug.apk"

# --- demo day -------------------------------------------------------------

ip: ## Print your LAN IP (the phone/judge needs this, not localhost)
	@ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || hostname -I 2>/dev/null || echo "could not detect"

demo: ## Print the demo-day checklist
	@echo ""
	@echo "  🎬 KARIGAR AI — DEMO DAY CHECKLIST"
	@echo "  ────────────────────────────────────────────────────────"
	@echo "  Your LAN IP: $$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo '??')"
	@echo ""
	@echo "  1. Phone + laptop on the SAME hotspot (use YOUR phone's hotspot,"
	@echo "     never the venue wifi — it will have client isolation on)."
	@echo "  2. make backend      (leave running)"
	@echo "  3. Point the app at your laptop:"
	@echo "     localStorage.setItem('karigar_api_base','http://<LAN-IP>:8000')"
	@echo "  4. Verify: open http://<LAN-IP>:8000/api/health ON THE PHONE."
	@echo "  5. If anything is flaky: FORCE_MOCK=1 in backend/.env, restart."
	@echo "  6. Nuclear fallback: localStorage.setItem('karigar_demo','1')"
	@echo "     — the app then runs fully offline on canned data."
	@echo ""
	@echo "  Full script: docs/DEMO_SCRIPT.md"
	@echo ""

clean: ## Remove build artifacts and caches (keeps your venv + node_modules)
	rm -rf frontend/dist backend/.pytest_cache backend/.ruff_cache
	find . -name __pycache__ -type d -prune -exec rm -rf {} + 2>/dev/null || true
	@echo "🧹 Cleaned"
