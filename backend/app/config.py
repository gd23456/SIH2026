"""App configuration loaded from environment / .env."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173,https://localhost"
    FORCE_MOCK: str = "0"

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def use_mock(self) -> bool:
        # Mock when explicitly forced, or when no key is configured.
        return self.FORCE_MOCK == "1" or not self.GEMINI_API_KEY.strip()


@lru_cache
def get_settings() -> Settings:
    return Settings()
