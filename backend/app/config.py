"""
Centralized application configuration.

All environment-dependent values are declared here as a single source of
truth so no other module reads `os.environ` directly. This makes settings
testable, type-checked, and easy to override in different environments
(dev / staging / production).
"""
import os
from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ---- Application ----
    APP_NAME: str = "Messenger Clone API"
    APP_ENV: str = "development"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"

    # ---- Database ----
    DATABASE_URL: str
    ASYNC_DATABASE_URL: str

    # ---- JWT ----
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # ---- CORS ----
    CORS_ORIGINS: str = "http://localhost:5173"

    # ---- File storage ----
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE_MB: int = 25
    BASE_URL: str = "http://localhost:8000"

    # ---- Rate limiting ----
    RATE_LIMIT_PER_MINUTE: int = 60

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def effective_database_url(self) -> str:
        url = os.getenv("DATABASE_URL") or self.DATABASE_URL
        if os.path.exists("/.dockerenv"):
            url = url.replace("localhost:5433", "db:5432").replace("127.0.0.1:5433", "db:5432")
        return url

    @property
    def effective_async_database_url(self) -> str:
        url = os.getenv("ASYNC_DATABASE_URL") or self.ASYNC_DATABASE_URL
        if os.path.exists("/.dockerenv"):
            url = url.replace("localhost:5433", "db:5432").replace("127.0.0.1:5433", "db:5432")
        return url

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def max_upload_size_bytes(self) -> int:
        return self.MAX_UPLOAD_SIZE_MB * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance — avoids re-parsing .env on every import."""
    return Settings()


settings = get_settings()
