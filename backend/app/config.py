"""App configuration loaded from environment / .env."""
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-flash-latest"
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173,https://localhost"
    FORCE_MOCK: str = "0"

    # Blank on purpose: the storefront + QR links are then derived from the
    # incoming request host, which is what makes them work over a laptop
    # hotspot on demo day. Only set this when deploying to a real domain.
    PUBLIC_BASE_URL: str = ""
    DATABASE_URL: str = "sqlite:///./karigar.db"

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
    def use_mock(self) -> bool:
        # Mock when explicitly forced, or when no key is configured.
        return self.FORCE_MOCK == "1" or not self.GEMINI_API_KEY.strip()


@lru_cache
def get_settings() -> Settings:
    return Settings()
