import os
import sys
from typing import Iterator

import pytest
import python_multipart
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from Backend import models  # noqa: F401  ensure models imported for metadata
from Backend.backend import app
from Backend.db import get_db

# Ensure tests load python_multipart instead of the deprecated multipart alias.
sys.modules["multipart"] = python_multipart


@pytest.fixture(name="engine")
def engine_fixture() -> Iterator:
    database_url = os.environ.get("DATABASE_URL", "sqlite://")

    engine_kwargs = {}
    if database_url.startswith("sqlite"):
        engine_kwargs = {
            "connect_args": {"check_same_thread": False},
            "poolclass": StaticPool,
        }

    engine = create_engine(database_url, **engine_kwargs)
    SQLModel.metadata.create_all(engine)
    try:
        yield engine
    finally:
        SQLModel.metadata.drop_all(engine)


@pytest.fixture(name="client")
def client_fixture(engine) -> Iterator[TestClient]:
    def override_get_db() -> Iterator[Session]:
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()
