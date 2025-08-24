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


def test_meal_crud(client: TestClient) -> None:
    response = client.post(
        "/api/meals",
        json={"name": "Test Meal", "ingredients": [], "tags": []},
    )
    assert response.status_code == 201
    meal = response.json()
    meal_id = meal["id"]
    assert meal["name"] == "Test Meal"

    response = client.get("/api/meals")
    assert response.status_code == 200
    assert any(item["id"] == meal_id for item in response.json())

    response = client.get(f"/api/meals/{meal_id}")
    assert response.status_code == 200
    assert response.json()["name"] == "Test Meal"

    response = client.put(
        f"/api/meals/{meal_id}",
        json={
            "id": meal_id,
            "name": "Updated Meal",
            "ingredients": [],
            "tags": [],
        },
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Updated Meal"

    response = client.delete(f"/api/meals/{meal_id}")
    assert response.status_code == 200
    response = client.get(f"/api/meals/{meal_id}")
    assert response.status_code == 404
