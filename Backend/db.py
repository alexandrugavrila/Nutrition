"""Database configuration using SQLModel."""

from typing import Generator

from sqlalchemy.orm import sessionmaker
from sqlmodel import SQLModel, Session, create_engine

from Backend.settings import settings

# Create the engine and configured ``SessionLocal`` class used throughout the
# application. ``autocommit`` and ``autoflush`` are disabled so changes are only
# persisted when explicitly committed.
engine = create_engine(settings.database_url)
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


__all__ = ["Base", "engine", "SessionLocal", "get_db"]
