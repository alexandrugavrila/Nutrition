"""Database configuration using SQLModel."""

import os
from typing import Generator

from sqlmodel import SQLModel, Session, create_engine
from sqlalchemy.orm import sessionmaker

# Configure the database connection string. Historically the application looked
# for ``SQLALCHEMY_DATABASE_URI``, but docker-compose provides the URL via the
# more conventional ``DATABASE_URL``. Attempt to read either environment
# variable and fall back to the default connection string used by the
# development stack.
DATABASE_URL = (
    os.getenv("SQLALCHEMY_DATABASE_URI")
    or os.getenv(
        "DATABASE_URL", "postgresql://nutrition_user:nutrition_pass@db:5432/nutrition"
    )
)

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


__all__ = ["Base", "engine", "SessionLocal", "get_db"]
