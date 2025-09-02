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
