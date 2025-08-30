import os

import httpx
import pytest

# Auto-skip if the branch-specific backend is not available
_port = os.getenv("BACKEND_PORT")
if not _port:
    pytest.skip("BACKEND_PORT not set; skipping e2e suite", allow_module_level=True)

BASE_URL = f"http://localhost:{_port}/api"

# Quick health check against a lightweight endpoint
try:
    httpx.get(f"{BASE_URL}/ingredients", timeout=1.0, follow_redirects=True)
except Exception:
    pytest.skip("Backend not reachable on BACKEND_PORT; skipping e2e suite", allow_module_level=True)


@pytest.mark.e2e
class TestIngredientRoutes:
    def test_crud_ingredient(self):
        create_payload = {
            "name": "Carrot",
            "nutrition": {
                "calories": 41,
                "fat": 0.2,
                "carbohydrates": 9.6,
                "protein": 0.9,
                "fiber": 2.8,
            },
            "units": [{"name": "100g", "grams": 100}],
        }

        # Create
        resp = httpx.post(f"{BASE_URL}/ingredients/", json=create_payload)
        assert resp.status_code == 201
        ingredient = resp.json()
        ingredient_id = ingredient["id"]
        assert ingredient["name"] == "Carrot"

        # Read
        resp = httpx.get(f"{BASE_URL}/ingredients/{ingredient_id}")
        assert resp.status_code == 200
        assert resp.json()["name"] == "Carrot"

        # Update
        update_payload = create_payload | {"name": "Carrot Fresh"}
        resp = httpx.put(f"{BASE_URL}/ingredients/{ingredient_id}", json=update_payload)
        assert resp.status_code == 200
        assert resp.json()["name"] == "Carrot Fresh"

        # Delete
        resp = httpx.delete(f"{BASE_URL}/ingredients/{ingredient_id}")
        assert resp.status_code == 200
        assert resp.json()["message"] == "Ingredient deleted successfully"


@pytest.mark.e2e
class TestMealRoutes:
    def test_crud_meal(self):
        # First create an ingredient to reference
        ingredient_payload = {
            "name": "Rice",
            "units": [{"name": "1 cup", "grams": 100}],
        }
        resp = httpx.post(f"{BASE_URL}/ingredients/", json=ingredient_payload)
        ingredient_id = resp.json()["id"]

        meal_payload = {
            "name": "Rice Bowl",
            "ingredients": [{"ingredient_id": ingredient_id, "unit_quantity": 1}],
        }

        # Create
        resp = httpx.post(f"{BASE_URL}/meals/", json=meal_payload)
        assert resp.status_code == 201
        meal = resp.json()
        meal_id = meal["id"]
        assert meal["name"] == "Rice Bowl"

        # Read
        resp = httpx.get(f"{BASE_URL}/meals/{meal_id}")
        assert resp.status_code == 200
        assert resp.json()["name"] == "Rice Bowl"

        # Update
        update_payload = meal_payload | {"name": "Rice Deluxe"}
        resp = httpx.put(f"{BASE_URL}/meals/{meal_id}", json=update_payload)
        assert resp.status_code == 200
        assert resp.json()["name"] == "Rice Deluxe"

        # Delete
        resp = httpx.delete(f"{BASE_URL}/meals/{meal_id}")
        assert resp.status_code == 200
        assert resp.json()["message"] == "Meal deleted successfully"

        # Clean up ingredient
        httpx.delete(f"{BASE_URL}/ingredients/{ingredient_id}")
