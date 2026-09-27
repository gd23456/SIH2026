"""App configuration loaded from environment / .env."""
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    # Anchored to backend/ rather than the bare ".env", which pydantic resolves
    # against the CURRENT WORKING DIRECTORY. `make backend` runs uvicorn from
    # the repo root with --app-dir backend, so a relative ".env" looked for
    # <repo root>/.env and silently found nothing — while every doc tells you to
    # put your key in backend/.env. The result: a correctly configured key was
    # ignored and /api/health still said "mock", with nothing explaining why.
    # It only worked if you happened to launch uvicorn from inside backend/.
    model_config = SettingsConfigDict(
        env_file=str(_BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-flash-latest"
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173,https://localhost"
    FORCE_MOCK: str = "0"

    # Blank on purpose: the storefront + QR links are then derived from the
    # incoming request host, which is what makes them work over a laptop
    # hotspot on demo day. Only set this when deploying to a real domain.
    PUBLIC_BASE_URL: str = ""
    DATABASE_URL: str = "sqlite:///./karigar.db"

    # "production" refuses development-only providers (see model3d). Anything
    # else is treated as development.
    APP_ENV: str = "development"

    # --- 3D reconstruction ------------------------------------------------
    # local    — self-hosted Hunyuan3D-2mv worker (model3d_server/). Free; runs
    #            on a Mac or any GPU box. Needs MODEL3D_LOCAL_URL.
    # meshy    — Meshy multi-image-to-3D (hosted, paid). Needs MESHY_API_KEY.
    # mock     — local test provider; refused when APP_ENV=production.
    # disabled — capture still works; no 3D is generated.
    # Blank = "meshy" when a key is configured, otherwise "disabled". Never
    # silently "mock": a fake model must be an explicit developer choice.
    MODEL3D_PROVIDER: str = ""
    MESHY_API_KEY: str = ""
    MESHY_API_BASE: str = "https://api.meshy.ai/openapi/v1"
    MESHY_AI_MODEL: str = "latest"
    MODEL3D_LOCAL_URL: str = ""
    # Shared secret between this backend and the worker (Bearer token).
    MODEL3D_LOCAL_TOKEN: str = ""
    # Give up on a job the provider hasn't finished in this long.
    MODEL3D_TIMEOUT_S: int = 1800
    # Captures + models for products never published are deleted after this.
    MODEL3D_RETENTION_DAYS: int = 7
    # Where uploaded views and generated models are stored.
    MEDIA_DIR: str = "./media"

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def database_url(self) -> str:
        """DATABASE_URL with any relative sqlite path anchored at `backend/`.

        `make backend` runs uvicorn from the repo root with `--app-dir backend`,
        so the shipped `sqlite:///./karigar.db` would drop the database in the
        repo root — outside the `backend/*.db` gitignore rule and one careless
        `git add -A` away from being committed. Anchoring it here means the file
        lands in the same place no matter which directory you started from.
        """
        prefix = "sqlite:///"
        if not self.DATABASE_URL.startswith(prefix):
            return self.DATABASE_URL

        raw = self.DATABASE_URL[len(prefix) :]
        if not raw or raw == ":memory:":
            return self.DATABASE_URL

        path = Path(raw)
        if not path.is_absolute():
            path = _BACKEND_DIR / path
        return f"{prefix}{path.resolve().as_posix()}"

    @property
    def is_production(self) -> bool:
        return self.APP_ENV.strip().lower() == "production"

    @property
    def media_path(self) -> Path:
        path = Path(self.MEDIA_DIR)
        if not path.is_absolute():
            path = _BACKEND_DIR / path
        return path.resolve()

    @property
    def model3d_provider(self) -> str:
        chosen = self.MODEL3D_PROVIDER.strip().lower()
        if not chosen:
            return "meshy" if self.MESHY_API_KEY.strip() else "disabled"
        return chosen

    @property
    def use_mock(self) -> bool:
        # Mock when explicitly forced, or when no key is configured.
        return self.FORCE_MOCK == "1" or not self.GEMINI_API_KEY.strip()


@lru_cache
def get_settings() -> Settings:
    return Settings()
