from fastapi.testclient import TestClient
from sqlmodel import Session

from Backend.models import PossibleIngredientTag, PossibleMealTag


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
