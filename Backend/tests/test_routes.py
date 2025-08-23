from typing import Iterator

import os
import sys

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, Session, create_engine

# Add repository root to ``sys.path`` so ``Backend`` package is importable
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from Backend.backend import app
from Backend.db import get_db
from Backend import models  # ensure models are imported for SQLModel metadata
from Backend.models import PossibleIngredientTag, PossibleMealTag


@pytest.fixture(name="engine")
def engine_fixture() -> Iterator[Session]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
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


def test_get_possible_ingredient_tags(client: TestClient, engine) -> None:
    with Session(engine) as session:
        session.add(PossibleIngredientTag(name="Spicy"))
        session.add(PossibleIngredientTag(name="Sweet"))
        session.commit()

    response = client.get("/api/ingredients/possible_tags")
    assert response.status_code == 200
    names = [tag["name"] for tag in response.json()]
    assert names == ["Spicy", "Sweet"]


def test_get_possible_meal_tags(client: TestClient, engine) -> None:
    with Session(engine) as session:
        session.add(PossibleMealTag(name="Breakfast"))
        session.add(PossibleMealTag(name="Dinner"))
        session.commit()

    response = client.get("/api/meals/possible_tags")
    assert response.status_code == 200
    names = [tag["name"] for tag in response.json()]
    assert names == ["Breakfast", "Dinner"]


def test_update_nonexistent_ingredient_returns_404(client: TestClient) -> None:
    response = client.put(
        "/api/ingredients/999",
        json={"id": 999, "name": "Ghost", "nutrition": None, "units": [], "tags": []},
    )
    assert response.status_code == 404


def test_delete_nonexistent_meal_returns_404(client: TestClient) -> None:
    response = client.delete("/api/meals/999")
    assert response.status_code == 404
