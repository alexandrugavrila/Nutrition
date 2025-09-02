"""Centralized application settings.

This module centralizes environment-driven configuration to avoid scattering
`os.getenv` calls across the codebase. Import `settings` and reference typed
attributes instead of reading environment variables directly.
"""

from __future__ import annotations

import os
from dataclasses import dataclass


def _to_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "t", "yes", "y"}


@dataclass(frozen=True)
class Settings:
    # Database URL resolution maintains historical precedence:
    # 1) SQLALCHEMY_DATABASE_URI (legacy)
    # 2) DATABASE_URL (current)
    # 3) default used by docker-compose (service name `db`)
    database_url: str

    # Create tables on startup (opt-in; default off)
    db_auto_create: bool

    # CORS configuration (kept permissive for dev by default).
    allow_origins: list[str]

    @staticmethod
    def load() -> "Settings":
        db_url = (
            os.getenv("SQLALCHEMY_DATABASE_URI")
            or os.getenv(
                "DATABASE_URL",
                "postgresql://nutrition_user:nutrition_pass@db:5432/nutrition",
            )
        )

        auto_create = _to_bool(os.getenv("DB_AUTO_CREATE"), default=False)

        # Comma-separated list or "*"
        origins_raw = os.getenv("CORS_ALLOW_ORIGINS", "*")
        if origins_raw.strip() == "*":
            origins = ["*"]
        else:
            origins = [o.strip() for o in origins_raw.split(",") if o.strip()]

        return Settings(
            database_url=db_url,
            db_auto_create=auto_create,
            allow_origins=origins,
        )


# Singleton settings instance
settings = Settings.load()

__all__ = ["settings", "Settings"]

