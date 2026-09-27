"""Test configuration.

Points DATABASE_URL at a throwaway file *before* `app` is imported, so running
the suite never reads or writes a developer's real karigar.db. Environment
variables outrank the .env file in pydantic-settings, and get_settings() is
lru_cached at app import, so this has to happen at collection time — which is
exactly when pytest loads conftest.
"""
from __future__ import annotations

import os
import tempfile
from pathlib import Path

_db = Path(tempfile.mkdtemp(prefix="karigar-tests-")) / "test.db"
# as_posix(): a Windows path with backslashes is not a valid sqlite URL.
os.environ["DATABASE_URL"] = f"sqlite:///{_db.as_posix()}"

# Always exercise the mock/offline path in tests — deterministic, fast, and no
# network. This also protects a developer who has a real GEMINI_API_KEY in
# backend/.env from having the suite make live API calls.
os.environ["FORCE_MOCK"] = "1"

# 3D: the dev provider, a throwaway media dir, and no background worker — tests
# drive the worker explicitly with process_pending_once(). An empty
# MESHY_API_KEY guarantees a developer's real key is never spent by the suite.
os.environ["MODEL3D_PROVIDER"] = "mock"
os.environ["MESHY_API_KEY"] = ""
os.environ["MEDIA_DIR"] = str(_db.parent / "media")
os.environ["KARIGAR_DISABLE_MODEL_WORKER"] = "1"
os.environ["APP_ENV"] = "development"

# Create the tables explicitly. The app does this in its lifespan handler, but
# `TestClient(app)` only runs lifespan when used as a context manager, and the
# suite constructs the client at module scope. Import order matters: this must
# come after DATABASE_URL is set above.
from app.db import init_db  # noqa: E402

init_db()
