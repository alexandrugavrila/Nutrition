# Backend/migrations/env.py
import os
import sys
from pathlib import Path
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

# add repository root to sys.path to allow importing Backend modules
sys.path.append(str(Path(__file__).resolve().parents[2]))

# Import models so Base.metadata is populated
from Backend.db import Base  # don't import DATABASE_URL here; we override below
from Backend import models  # noqa: F401

config = context.config

# ---- Resolve database URL priority: -x dburl > env var > Backend.db.DATABASE_URL > alembic.ini ----
xargs = context.get_x_argument(as_dictionary=True)
db_url = None

# 1) CLI override: alembic ... -x dburl="postgresql://..."
if "dburl" in xargs and xargs["dburl"]:
    db_url = xargs["dburl"]

# 2) Environment variable (set by your sync script)
if not db_url:
    db_url = os.environ.get("DATABASE_URL")

# 3) Fallback to Backend.db.DATABASE_URL if present
if not db_url:
    try:
        from Backend.db import DATABASE_URL as DB_URL_FALLBACK
        db_url = DB_URL_FALLBACK
    except Exception:
        pass

# 4) Final fallback: whatever is in alembic.ini (sqlalchemy.url)
if not db_url:
    db_url = config.get_main_option("sqlalchemy.url")

if not db_url:
    raise RuntimeError("No database URL could be determined for Alembic migrations.")

config.set_main_option("sqlalchemy.url", db_url)

# Optional: log config (if alembic.ini present)
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

def run_migrations_offline():
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online():
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
