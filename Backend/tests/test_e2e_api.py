import os

import httpx
from uuid import uuid4
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


def _ok(msg: str) -> None:
    """Lightweight step logger for explicit PASS messages.

    Shown when running pytest with `-s` (or with live logging enabled).
    """
    print(f"[E2E PASS] {msg}")


@pytest.mark.e2e
class TestIngredientRoutes:
    def test_crud_ingredient(self):
        print()
        unique_ing_name = f"_test_e2e_ingredient_{uuid4().hex[:8]}"
        create_payload = {
            "name": unique_ing_name,
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
        assert resp.status_code == 201, f"create ingredient expected 201, got {resp.status_code}: {resp.text}"
        ingredient = resp.json()
        ingredient_id = ingredient["id"]
        assert ingredient["name"] == unique_ing_name, "created ingredient name should match request"
        _ok(f"Created ingredient '{unique_ing_name}' with id={ingredient_id}")

        # Read
        resp = httpx.get(f"{BASE_URL}/ingredients/{ingredient_id}")
        assert resp.status_code == 200, f"read ingredient expected 200, got {resp.status_code}: {resp.text}"
        assert resp.json()["name"] == unique_ing_name, "fetched ingredient name should equal created name"
        _ok("Fetched ingredient by id with expected name")

        # Update
        updated_ing_name = f"{unique_ing_name}_updated"
        update_payload = create_payload | {"name": updated_ing_name}
        resp = httpx.put(f"{BASE_URL}/ingredients/{ingredient_id}", json=update_payload)
        assert resp.status_code == 200, f"update ingredient expected 200, got {resp.status_code}: {resp.text}"
        assert resp.json()["name"] == updated_ing_name, "updated ingredient name should be persisted"
        _ok("Updated ingredient name persisted")

        # Delete
        resp = httpx.delete(f"{BASE_URL}/ingredients/{ingredient_id}")
        assert resp.status_code == 200, f"delete ingredient expected 200, got {resp.status_code}: {resp.text}"
        assert resp.json()["message"] == "Ingredient deleted successfully", "delete response should include success message"
        _ok("Deleted ingredient successfully")


@pytest.mark.e2e
class TestMealRoutes:
    def test_crud_meal(self):
        print()
        # First create an ingredient to reference
        unique_ing_name = f"_test_e2e_ingredient_{uuid4().hex[:8]}"
        ingredient_payload = {
            "name": unique_ing_name,
            "units": [{"name": "1 cup", "grams": 100}],
        }
        resp = httpx.post(f"{BASE_URL}/ingredients/", json=ingredient_payload)
        assert resp.status_code == 201, f"seed ingredient expected 201, got {resp.status_code}: {resp.text}"
        ingredient_id = resp.json()["id"]
        _ok(f"Seeded ingredient '{unique_ing_name}' id={ingredient_id}")

        unique_meal_name = f"_test_e2e_meal_{uuid4().hex[:8]}"
        meal_payload = {
            "name": unique_meal_name,
            "ingredients": [{"ingredient_id": ingredient_id, "unit_quantity": 1}],
        }

        # Create
        resp = httpx.post(f"{BASE_URL}/meals/", json=meal_payload)
        assert resp.status_code == 201, f"create meal expected 201, got {resp.status_code}: {resp.text}"
        meal = resp.json()
        meal_id = meal["id"]
        assert meal["name"] == unique_meal_name, "created meal name should match request"
        _ok(f"Created meal '{unique_meal_name}' with id={meal_id}")

        # Read
        resp = httpx.get(f"{BASE_URL}/meals/{meal_id}")
        assert resp.status_code == 200, f"read meal expected 200, got {resp.status_code}: {resp.text}"
        assert resp.json()["name"] == unique_meal_name, "fetched meal name should equal created name"
        _ok("Fetched meal by id with expected name")

        # Update
        updated_meal_name = f"{unique_meal_name}_updated"
        update_payload = meal_payload | {"name": updated_meal_name}
        resp = httpx.put(f"{BASE_URL}/meals/{meal_id}", json=update_payload)
        assert resp.status_code == 200, f"update meal expected 200, got {resp.status_code}: {resp.text}"
        assert resp.json()["name"] == updated_meal_name, "updated meal name should be persisted"
        _ok("Updated meal name persisted")

        # Delete
        resp = httpx.delete(f"{BASE_URL}/meals/{meal_id}")
        assert resp.status_code == 200, f"delete meal expected 200, got {resp.status_code}: {resp.text}"
        assert resp.json()["message"] == "Meal deleted successfully", "delete response should include success message"
        _ok("Deleted meal successfully")

        # Clean up ingredient
        httpx.delete(f"{BASE_URL}/ingredients/{ingredient_id}")
        _ok("Cleaned up seed ingredient")
