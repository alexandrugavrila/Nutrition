from fastapi.testclient import TestClient
from sqlmodel import Session

from Backend.models import (
    PossibleIngredientTag,
    PossibleMealTag,
    Ingredient,
    Meal,
)


def test_get_possible_ingredient_tags(client: TestClient, engine) -> None:
    with Session(engine) as session:
        session.add(PossibleIngredientTag(name="Spicy", group="Flavor"))
        session.add(PossibleIngredientTag(name="Sweet", group="Flavor"))
        session.commit()

    response = client.get("/api/ingredients/possible_tags")
    assert response.status_code == 200
    data = response.json()
    names = [tag["name"] for tag in data]
    groups = [tag["group"] for tag in data]
    assert names == ["Spicy", "Sweet"]
    assert groups == ["Flavor", "Flavor"]


def test_get_possible_meal_tags(client: TestClient, engine) -> None:
    with Session(engine) as session:
        session.add(PossibleMealTag(name="Breakfast", group="Time"))
        session.add(PossibleMealTag(name="Dinner", group="Time"))
        session.commit()

    response = client.get("/api/meals/possible_tags")
    assert response.status_code == 200
    data = response.json()
    names = [tag["name"] for tag in data]
    groups = [tag["group"] for tag in data]
    assert names == ["Breakfast", "Dinner"]
    assert groups == ["Time", "Time"]


def test_crud_possible_ingredient_tag(client: TestClient) -> None:
    response = client.post(
        "/api/ingredients/possible_tags",
        json={"name": "Bitter", "group": "Flavor"},
    )
    assert response.status_code == 201
    tag = response.json()
    tag_id = tag["id"]
    assert tag["group"] == "Flavor"

    response = client.put(
        f"/api/ingredients/possible_tags/{tag_id}",
        json={"name": "Umami", "group": "Taste"},
    )
    assert response.status_code == 200
    updated = response.json()
    assert updated["name"] == "Umami"
    assert updated["group"] == "Taste"

    response = client.delete(f"/api/ingredients/possible_tags/{tag_id}")
    assert response.status_code == 200
    assert response.json()["message"] == "Tag deleted successfully"


def test_delete_linked_ingredient_tag_returns_error(
    client: TestClient, engine
) -> None:
    with Session(engine) as session:
        tag = PossibleIngredientTag(name="Herb", group="Category")
        ingredient = Ingredient(name="Basil", units=[], tags=[tag])
        session.add(tag)
        session.add(ingredient)
        session.commit()
        tag_id = tag.id

    response = client.delete(f"/api/ingredients/possible_tags/{tag_id}")
    assert response.status_code == 400


def test_crud_possible_meal_tag(client: TestClient) -> None:
    response = client.post(
        "/api/meals/possible_tags",
        json={"name": "Snack", "group": "Time"},
    )
    assert response.status_code == 201
    tag = response.json()
    tag_id = tag["id"]
    assert tag["group"] == "Time"

    response = client.put(
        f"/api/meals/possible_tags/{tag_id}",
        json={"name": "Brunch", "group": "Occasion"},
    )
    assert response.status_code == 200
    updated = response.json()
    assert updated["name"] == "Brunch"
    assert updated["group"] == "Occasion"

    response = client.delete(f"/api/meals/possible_tags/{tag_id}")
    assert response.status_code == 200
    assert response.json()["message"] == "Tag deleted successfully"


def test_delete_linked_meal_tag_returns_error(client: TestClient, engine) -> None:
    with Session(engine) as session:
        tag = PossibleMealTag(name="Lunch", group="Time")
        meal = Meal(name="Sandwich", ingredients=[], tags=[tag])
        session.add(tag)
        session.add(meal)
        session.commit()
        tag_id = tag.id

    response = client.delete(f"/api/meals/possible_tags/{tag_id}")
    assert response.status_code == 400


def test_update_nonexistent_ingredient_returns_404(client: TestClient) -> None:
    response = client.put(
        "/api/ingredients/999",
        json={"id": 999, "name": "Ghost", "nutrition": None, "units": [], "tags": []},
    )
    assert response.status_code == 404


def test_delete_nonexistent_meal_returns_404(client: TestClient) -> None:
    response = client.delete("/api/meals/999")
    assert response.status_code == 404
