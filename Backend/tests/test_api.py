from fastapi.testclient import TestClient


def test_ingredient_crud(client: TestClient) -> None:
    response = client.post(
        "/api/ingredients/",
        json={"name": "Carrot", "nutrition": None, "units": [], "tags": []},
    )
    assert response.status_code == 201
    ingredient = response.json()
    ingredient_id = ingredient["id"]
    assert ingredient["name"] == "Carrot"

    response = client.get("/api/ingredients/")
    assert response.status_code == 200
    assert any(item["id"] == ingredient_id for item in response.json())

    response = client.get(f"/api/ingredients/{ingredient_id}")
    assert response.status_code == 200
    assert response.json()["name"] == "Carrot"

    response = client.put(
        f"/api/ingredients/{ingredient_id}",
        json={
            "id": ingredient_id,
            "name": "Carrot Updated",
            "nutrition": None,
            "units": [],
            "tags": [],
        },
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Carrot Updated"

    response = client.delete(f"/api/ingredients/{ingredient_id}")
    assert response.status_code == 200
    response = client.get(f"/api/ingredients/{ingredient_id}")
    assert response.status_code == 404


def test_ingredient_update_with_shopping_unit_id_only(client: TestClient) -> None:
    """Selecting a preferred unit by id should not require the relationship to be loaded."""

    create_payload = {
        "name": "Rolled Oats",
        "nutrition": None,
        "units": [
            {"name": "cup", "grams": 85},
            {"name": "g", "grams": 1},
        ],
        "tags": [],
    }
    response = client.post("/api/ingredients/", json=create_payload)
    assert response.status_code == 201
    ingredient = response.json()

    gram_unit = next(unit for unit in ingredient["units"] if unit["name"] == "g")
    update_payload = {
        "name": ingredient["name"],
        "nutrition": None,
        "units": [
            {
                "id": unit["id"],
                "name": unit["name"],
                "grams": unit["grams"],
            }
            for unit in ingredient["units"]
            if unit["name"] != "g"
        ],
        "tags": [],
        "shopping_unit": {
            "unit_id": gram_unit["id"],
            "name": gram_unit["name"],
            "grams": gram_unit["grams"],
        },
    }

    response = client.put(f"/api/ingredients/{ingredient['id']}", json=update_payload)
    assert response.status_code == 200
    updated = response.json()
    assert updated["shopping_unit_id"] == gram_unit["id"]
    assert updated["shopping_unit"]["name"] == "g"

    response = client.get("/api/ingredients/")
    assert response.status_code == 200
    fetched = next(item for item in response.json() if item["id"] == ingredient["id"])
    assert fetched["shopping_unit_id"] == gram_unit["id"]
    assert fetched["shopping_unit"]["name"] == "g"


def test_food_crud(client: TestClient) -> None:
    response = client.post(
        "/api/foods",
        json={"name": "Test Food", "ingredients": [], "tags": []},
    )
    assert response.status_code == 201
    food = response.json()
    food_id = food["id"]
    assert food["name"] == "Test Food"

    response = client.get("/api/foods")
    assert response.status_code == 200
    assert any(item["id"] == food_id for item in response.json())

    response = client.get(f"/api/foods/{food_id}")
    assert response.status_code == 200
    assert response.json()["name"] == "Test Food"

    response = client.put(
        f"/api/foods/{food_id}",
        json={
            "id": food_id,
            "name": "Updated Food",
            "ingredients": [],
            "tags": [],
        },
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Updated Food"

    response = client.delete(f"/api/foods/{food_id}")
    assert response.status_code == 200
    response = client.get(f"/api/foods/{food_id}")
    assert response.status_code == 404
