"""Database configuration using SQLModel."""

from typing import Generator

from sqlalchemy.orm import sessionmaker
from sqlmodel import SQLModel, Session, create_engine

from Backend.settings import settings

# ``DATABASE_URL`` used to be exported as a module level constant and some of
# the auxiliary tooling (most notably the Alembic environment script) still
# looks for it when resolving the database connection string.  Keeping the
# constant in sync with the Settings instance ensures those legacy code paths
# continue to work while the rest of the application relies on ``settings``.
DATABASE_URL = settings.database_url

# Create the engine and configured ``SessionLocal`` class used throughout the
# application. ``autocommit`` and ``autoflush`` are disabled so changes are only
# persisted when explicitly committed.
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, class_=Session)

# Alias ``SQLModel`` as ``Base`` to mimic the previous declarative base.
Base = SQLModel


def get_db() -> Generator[Session, None, None]:
    """Provide a transactional scope around a series of operations."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


__all__ = ["Base", "engine", "SessionLocal", "get_db", "DATABASE_URL"]
