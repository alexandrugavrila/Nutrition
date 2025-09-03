import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from Backend.models import (
    Ingredient,
    IngredientUnit,
    Meal,
    MealIngredient,
    PossibleIngredientTag,
    PossibleMealTag,
)


@pytest.mark.parametrize(
    "case",
    [
        "list",
        "get",
        "post",
        "put",
        "delete",
        "possible_tags",
    ],
)
def test_ingredient_endpoints(client: TestClient, engine, case: str) -> None:
    """Test ingredient API endpoints for various cases."""
    with Session(engine) as session:
        if case in {"list", "get", "put", "delete"}:
            tag = PossibleIngredientTag(name="Spicy", group="Flavor")
            ingredient = Ingredient(name="Pepper", units=[], tags=[tag])
            session.add(tag)
            session.add(ingredient)
            session.commit()
            ingredient_id = ingredient.id
        elif case == "post":
            tag = PossibleIngredientTag(name="Sweet", group="Flavor")
            session.add(tag)
            session.commit()
            tag_id = tag.id
        elif case == "possible_tags":
            session.add(PossibleIngredientTag(name="Savory", group="Flavor"))
            session.commit()

    if case == "list":
        response = client.get("/api/ingredients/")
        assert response.status_code == 200
        assert any(item["name"] == "Pepper" for item in response.json())
    elif case == "get":
        response = client.get(f"/api/ingredients/{ingredient_id}")
        assert response.status_code == 200
        assert response.json()["name"] == "Pepper"
    elif case == "post":
        payload = {
            "name": "Onion",
            "nutrition": None,
            "units": [{"name": "g", "grams": 1}],
            "tags": [{"id": tag_id}],
        }
        response = client.post("/api/ingredients/", json=payload)
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Onion"
        assert any(t["id"] == tag_id for t in data["tags"])
    elif case == "put":
        payload = {
            "name": "Pepper Updated",
            "nutrition": None,
            "units": [],
            "tags": [],
        }
        response = client.put(f"/api/ingredients/{ingredient_id}", json=payload)
        assert response.status_code == 200
        assert response.json()["name"] == "Pepper Updated"
    elif case == "delete":
        response = client.delete(f"/api/ingredients/{ingredient_id}")
        assert response.status_code == 200
        assert response.json()["message"] == "Ingredient deleted successfully"
    elif case == "possible_tags":
        response = client.get("/api/ingredients/possible_tags")
        assert response.status_code == 200
        assert any(tag["name"] == "Savory" for tag in response.json())


@pytest.mark.parametrize(
    "case",
    [
        "list",
        "get",
        "post",
        "put",
        "delete",
        "possible_tags",
    ],
)
def test_meal_endpoints(client: TestClient, engine, case: str) -> None:
    """Test meal API endpoints for various cases."""
    with Session(engine) as session:
        if case in {"list", "get", "put", "delete"}:
            ingredient = Ingredient(
                name="Rice",
                units=[IngredientUnit(name="g", grams=1)],
            )
            tag = PossibleMealTag(name="Dinner", group="Time")
            session.add_all([ingredient, tag])
            session.commit()
            ingredient_id = ingredient.id
            unit_id = ingredient.units[0].id
            meal = Meal(
                name="Rice Bowl",
                ingredients=[
                    MealIngredient(
                        ingredient_id=ingredient_id,
                        unit_id=unit_id,
                        unit_quantity=100,
                    )
                ],
                tags=[tag],
            )
            session.add(meal)
            session.commit()
            meal_id = meal.id
        elif case == "post":
            ingredient = Ingredient(
                name="Beans",
                units=[IngredientUnit(name="g", grams=1)],
            )
            tag = PossibleMealTag(name="Lunch", group="Time")
            session.add_all([ingredient, tag])
            session.commit()
            ingredient_id = ingredient.id
            unit_id = ingredient.units[0].id
            tag_id = tag.id
        elif case == "possible_tags":
            session.add(PossibleMealTag(name="Snack", group="Time"))
            session.commit()

    if case == "list":
        response = client.get("/api/meals/")
        assert response.status_code == 200
        assert any(item["name"] == "Rice Bowl" for item in response.json())
    elif case == "get":
        response = client.get(f"/api/meals/{meal_id}")
        assert response.status_code == 200
        assert response.json()["name"] == "Rice Bowl"
    elif case == "post":
        payload = {
            "name": "Bean Salad",
            "ingredients": [
                {
                    "ingredient_id": ingredient_id,
                    "unit_id": unit_id,
                    "unit_quantity": 50,
                }
            ],
            "tags": [{"id": tag_id}],
        }
        response = client.post("/api/meals/", json=payload)
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Bean Salad"
        assert data["ingredients"][0]["ingredient_id"] == ingredient_id
        assert any(t["id"] == tag_id for t in data["tags"])
    elif case == "put":
        payload = {
            "name": "Rice Bowl Updated",
            "ingredients": [
                {
                    "ingredient_id": ingredient_id,
                    "unit_id": unit_id,
                    "unit_quantity": 150,
                }
            ],
            "tags": [],
        }
        response = client.put(f"/api/meals/{meal_id}", json=payload)
        assert response.status_code == 200
        assert response.json()["name"] == "Rice Bowl Updated"
    elif case == "delete":
        response = client.delete(f"/api/meals/{meal_id}")
        assert response.status_code == 200
        assert response.json()["message"] == "Meal deleted successfully"
    elif case == "possible_tags":
        response = client.get("/api/meals/possible_tags")
        assert response.status_code == 200
        assert any(tag["name"] == "Snack" for tag in response.json())
