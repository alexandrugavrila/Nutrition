import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session

from Backend.models import (
    PossibleIngredientTag,
    PossibleIngredientTagRead,
    PossibleMealTag,
    PossibleMealTagRead,
)


def test_get_possible_ingredient_tags(client: TestClient, engine) -> None:
    with Session(engine) as session:
        session.add(PossibleIngredientTag(name="Spicy", group="Flavor"))
        session.add(PossibleIngredientTag(name="Sweet", group="Flavor"))
        session.commit()

    response = client.get("/api/ingredients/possible_tags")
    assert response.status_code == 200
    tags = [PossibleIngredientTagRead.model_validate(t) for t in response.json()]
    assert [(t.name, t.group) for t in tags] == [
        ("Spicy", "Flavor"),
        ("Sweet", "Flavor"),
    ]


def test_get_possible_meal_tags(client: TestClient, engine) -> None:
    with Session(engine) as session:
        session.add(PossibleMealTag(name="Breakfast", group="Type"))
        session.add(PossibleMealTag(name="Dinner", group="Type"))
        session.commit()

    response = client.get("/api/meals/possible_tags")
    assert response.status_code == 200
    tags = [PossibleMealTagRead.model_validate(t) for t in response.json()]
    assert [(t.name, t.group) for t in tags] == [
        ("Breakfast", "Type"),
        ("Dinner", "Type"),
    ]


def test_possible_ingredient_tag_uniqueness(engine) -> None:
    with Session(engine) as session:
        session.add(PossibleIngredientTag(name="Spicy", group="Flavor"))
        session.add(PossibleIngredientTag(name="Spicy", group="Flavor"))
        with pytest.raises(IntegrityError):
            session.commit()


def test_possible_meal_tag_uniqueness(engine) -> None:
    with Session(engine) as session:
        session.add(PossibleMealTag(name="Breakfast", group="Type"))
        session.add(PossibleMealTag(name="Breakfast", group="Type"))
        with pytest.raises(IntegrityError):
            session.commit()


def test_update_nonexistent_ingredient_returns_404(client: TestClient) -> None:
    response = client.put(
        "/api/ingredients/999",
        json={"id": 999, "name": "Ghost", "nutrition": None, "units": [], "tags": []},
    )
    assert response.status_code == 404


def test_delete_nonexistent_meal_returns_404(client: TestClient) -> None:
    response = client.delete("/api/meals/999")
    assert response.status_code == 404
