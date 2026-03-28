"""Centralized application settings.

This module centralizes environment-driven configuration to avoid scattering
`os.getenv` calls across the codebase. Import `settings` and reference typed
attributes instead of reading environment variables directly.
"""

from __future__ import annotations

import os
import warnings
from pathlib import Path
from dataclasses import dataclass


def _to_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "t", "yes", "y"}


def _load_dotenv() -> None:
    env_path = Path(__file__).resolve().parents[1] / ".env"
    if not env_path.exists():
        warnings.warn(
            ".env file not found. Copy .env.template to .env and set required keys.",
            RuntimeWarning,
        )
        return

    for line in env_path.read_text().splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue

        key, separator, value = stripped.partition("=")
        if not separator:
            continue

        key = key.strip()
        if not key or key in os.environ:
            continue

        value = value.strip().strip('"').strip("'")
        os.environ[key] = value


@dataclass(frozen=True)
class Settings:
    # Database URL resolution maintains historical precedence:
    # 1) SQLALCHEMY_DATABASE_URI (legacy)
    # 2) DATABASE_URL (current)
    # 3) fallback to a local SQLite file when nothing is configured
    database_url: str

    # Create tables on startup (opt-in; default off)
    db_auto_create: bool

    # CORS configuration (kept permissive for dev by default).
    allow_origins: list[str]

    # USDA FoodData Central API key.
    usda_api_key: str | None

    @staticmethod
    def load() -> "Settings":
        _load_dotenv()
        db_url = os.getenv("SQLALCHEMY_DATABASE_URI") or os.getenv("DATABASE_URL")

        if not db_url:
            # Fall back to a local SQLite database so the API can boot outside the
            # docker-compose stack without any additional configuration.  The
            # relative path keeps the file inside the repository root which makes
            # it easy to inspect or reset during development.
            db_url = "sqlite:///./nutrition.db"

        auto_create_default = db_url.lower().startswith("sqlite")
        auto_create = _to_bool(
            os.getenv("DB_AUTO_CREATE"), default=auto_create_default
        )

        # Comma-separated list or "*".
        # Keep ALLOW_ORIGINS as a backward-compatible alias used by older
        # deployment manifests.
        origins_raw = os.getenv("CORS_ALLOW_ORIGINS") or os.getenv("ALLOW_ORIGINS", "*")
        if origins_raw.strip() == "*":
            origins = ["*"]
        else:
            origins = [o.strip() for o in origins_raw.split(",") if o.strip()]

        usda_api_key = os.getenv("USDA_API_KEY")
        if not usda_api_key:
            warnings.warn(
                "USDA_API_KEY is not set. USDA endpoints will not be available.",
                RuntimeWarning,
            )

        return Settings(
            database_url=db_url,
            db_auto_create=auto_create,
            allow_origins=origins,
            usda_api_key=usda_api_key,
        )


# Singleton settings instance
settings = Settings.load()

__all__ = ["settings", "Settings"]
