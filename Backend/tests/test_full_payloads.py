import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from Backend.models import PossibleIngredientTag, PossibleMealTag


def test_full_ingredient_crud(client: TestClient, engine) -> None:
    with Session(engine) as session:
        spicy = PossibleIngredientTag(name="Spicy", group="Flavor")
        sweet = PossibleIngredientTag(name="Sweet", group="Flavor")
        session.add(spicy)
        session.add(sweet)
        session.commit()
        spicy_id = spicy.id
        sweet_id = sweet.id

    payload = {
        "name": "Carrot",
        "nutrition": {
            "calories": 41.0,
            "fat": 0.2,
            "carbohydrates": 9.6,
            "protein": 0.9,
            "fiber": 2.8,
        },
        "units": [
            {"name": "gram", "grams": 1.0},
            {"name": "cup", "grams": 128.0},
        ],
        "tags": [{"id": spicy_id}, {"id": sweet_id}],
    }

    response = client.post("/api/ingredients/", json=payload)
    assert response.status_code == 201
    ingredient = response.json()
    ingredient_id = ingredient["id"]
    assert ingredient["nutrition"]["calories"] == pytest.approx(41.0)
    assert len(ingredient["units"]) == 3
    assert {t["name"] for t in ingredient["tags"]} == {"Spicy", "Sweet"}

    response = client.get(f"/api/ingredients/{ingredient_id}")
    assert response.status_code == 200
    fetched = response.json()
    nutrition_id = fetched["nutrition"]["id"]
    unit_ids = [u["id"] for u in fetched["units"]]

    update_payload = {
        "id": ingredient_id,
        "name": "Carrot Updated",
        "nutrition": {
            "id": nutrition_id,
            "ingredient_id": ingredient_id,
            "calories": 50.0,
            "fat": 0.3,
            "carbohydrates": 10.0,
            "protein": 1.0,
            "fiber": 3.0,
        },
        "units": [
            {
                "id": unit_ids[0],
                "ingredient_id": ingredient_id,
                "name": "gram",
                "grams": 1.0,
            },
            {
                "id": unit_ids[1],
                "ingredient_id": ingredient_id,
                "name": "cup",
                "grams": 128.0,
            },
        ],
        "tags": [{"id": spicy_id}],
    }

    response = client.put(f"/api/ingredients/{ingredient_id}", json=update_payload)
    assert response.status_code == 200
    updated = response.json()
    assert updated["name"] == "Carrot Updated"
    assert updated["nutrition"]["calories"] == pytest.approx(50.0)
    assert len(updated["tags"]) == 1 and updated["tags"][0]["name"] == "Spicy"

    response = client.delete(f"/api/ingredients/{ingredient_id}")
    assert response.status_code == 200
    response = client.get(f"/api/ingredients/{ingredient_id}")
    assert response.status_code == 404


def test_full_meal_crud(client: TestClient, engine) -> None:
    with Session(engine) as session:
        meal_tag1 = PossibleMealTag(name="Breakfast", group="Type")
        meal_tag2 = PossibleMealTag(name="Healthy", group="Diet")
        ing_tag = PossibleIngredientTag(name="Vegetable", group="Group")
        session.add_all([meal_tag1, meal_tag2, ing_tag])
        session.commit()
        meal_tag1_id = meal_tag1.id
        meal_tag2_id = meal_tag2.id
        ing_tag_id = ing_tag.id

    ingredient_payload = {
        "name": "Onion",
        "nutrition": {
            "calories": 40.0,
            "fat": 0.1,
            "carbohydrates": 9.0,
            "protein": 1.1,
            "fiber": 1.7,
        },
        "units": [{"name": "gram", "grams": 1.0}],
        "tags": [{"id": ing_tag_id}],
    }

    response = client.post("/api/ingredients/", json=ingredient_payload)
    assert response.status_code == 201
    ingredient = response.json()
    ingredient_id = ingredient["id"]
    unit_id = ingredient["units"][0]["id"]

    meal_payload = {
        "name": "Onion Omelette",
        "ingredients": [
            {
                "ingredient_id": ingredient_id,
                "unit_id": unit_id,
                "unit_quantity": 2.0,
            }
        ],
        "tags": [{"id": meal_tag1_id}, {"id": meal_tag2_id}],
    }

    response = client.post("/api/meals", json=meal_payload)
    assert response.status_code == 201
    meal = response.json()
    meal_id = meal["id"]
    assert meal["ingredients"][0]["unit_quantity"] == pytest.approx(2.0)
    assert {t["name"] for t in meal["tags"]} == {"Breakfast", "Healthy"}

    response = client.get(f"/api/meals/{meal_id}")
    assert response.status_code == 200
    fetched = response.json()

    update_payload = {
        "id": meal_id,
        "name": "Onion Omelette Deluxe",
        "ingredients": [
            {
                "ingredient_id": ingredient_id,
                "meal_id": meal_id,
                "unit_id": unit_id,
                "unit_quantity": 3.0,
            }
        ],
        "tags": [{"id": meal_tag1_id}],
    }

    response = client.put(f"/api/meals/{meal_id}", json=update_payload)
    assert response.status_code == 200
    updated = response.json()
    assert updated["name"] == "Onion Omelette Deluxe"
    assert updated["ingredients"][0]["unit_quantity"] == pytest.approx(3.0)
    assert len(updated["tags"]) == 1 and updated["tags"][0]["name"] == "Breakfast"

    response = client.delete(f"/api/meals/{meal_id}")
    assert response.status_code == 200
    response = client.get(f"/api/meals/{meal_id}")
    assert response.status_code == 404
