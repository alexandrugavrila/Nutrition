"""Validate that the branch-local database is on the latest Alembic revision."""

from __future__ import annotations

import os
import sys
from pathlib import Path

from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine
from sqlalchemy.exc import SQLAlchemyError

REPO_ROOT = Path(__file__).resolve().parents[2]
ALEMBIC_INI = REPO_ROOT / "Backend" / "alembic.ini"
MIGRATIONS_DIR = REPO_ROOT / "Backend" / "migrations"


def _load_alembic_config() -> Config:
    config = Config(str(ALEMBIC_INI))
    try:
        config.set_main_option("script_location", str(MIGRATIONS_DIR))
    except Exception:
        pass
    return config


def _format_heads(heads: set[str]) -> str:
    if not heads:
        return "(none)"
    return ", ".join(sorted(heads))


def main() -> int:
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("Skipping branch database revision check: DATABASE_URL is not set.")
        return 0

    try:
        engine = create_engine(database_url)
    except Exception as exc:
        print(
            "Warning: could not create SQLAlchemy engine for DATABASE_URL "
            f"({exc})."
        )
        return 0

    config = _load_alembic_config()
    script = ScriptDirectory.from_config(config)
    heads = set(script.get_heads())

    try:
        with engine.connect() as connection:
            context = MigrationContext.configure(connection)
            current_revision = context.get_current_revision()
    except SQLAlchemyError as exc:
        print(
            "Warning: could not inspect branch database "
            f"({exc}). Is the database container running?"
        )
        return 0
    finally:
        engine.dispose()

    if current_revision in heads:
        print(
            "Branch database is up to date "
            f"(revision {current_revision})."
        )
        return 0

    if current_revision is None:
        print("Warning: branch database has no recorded Alembic revision.")
        print(f"Expected head(s): {_format_heads(heads)}")
        print(
            "Run migrations for your branch database (for example, "
            "'pwsh ./scripts/docker/compose.ps1 up data -test' or "
            "'./scripts/docker/compose.sh up data -test')."
        )
        return 3

    print("Warning: branch database revision does not match migration head(s).")
    print(f"  Current revision: {current_revision}")
    print(f"  Expected head(s): {_format_heads(heads)}")
    print(
        "Run migrations for your branch database (for example, "
        "'pwsh ./scripts/docker/compose.ps1 up data -test' or "
        "'./scripts/docker/compose.sh up data -test')."
    )
    return 3


if __name__ == "__main__":
    sys.exit(main())
