from datetime import date

from fastapi.testclient import TestClient
from sqlmodel import Session

from Backend.models import Ingredient, StoredFood


def _create_ingredient(session: Session, name: str = "Ingredient") -> Ingredient:
    ingredient = Ingredient(name=name)
    session.add(ingredient)
    session.commit()
    session.refresh(ingredient)
    return ingredient


def test_create_stored_food_entry(client: TestClient, engine) -> None:
    with Session(engine) as session:
        ingredient = _create_ingredient(session, "Chicken Breast")

    payload = {
        "user_id": "user-1",
        "ingredient_id": ingredient.id,
        "prepared_portions": 4,
        "per_portion_calories": 250,
        "per_portion_protein": 30,
        "per_portion_carbohydrates": 5,
        "per_portion_fat": 8,
        "per_portion_fiber": 1,
    }

    response = client.post("/api/stored_food/", json=payload)
    assert response.status_code == 201
    body = response.json()
    assert body["remaining_portions"] == 4
    assert body["is_finished"] is False
    assert body["ingredient_id"] == ingredient.id

    with Session(engine) as session:
        stored = session.get(StoredFood, body["id"])
        assert stored is not None
        assert stored.remaining_portions == 4
        assert stored.is_finished is False


def test_list_stored_food_filters(client: TestClient, engine) -> None:
    with Session(engine) as session:
        ingredient = _create_ingredient(session, "Pulled Pork")

    base_payload = {
        "user_id": "user-2",
        "ingredient_id": ingredient.id,
        "prepared_portions": 6,
        "per_portion_calories": 200,
        "per_portion_protein": 20,
        "per_portion_carbohydrates": 10,
        "per_portion_fat": 7,
        "per_portion_fiber": 2,
    }

    first_response = client.post(
        "/api/stored_food/",
        json={**base_payload, "prepared_at": "2024-01-01T12:00:00Z"},
    )
    assert first_response.status_code == 201
    first = first_response.json()
    second_response = client.post(
        "/api/stored_food/",
        json={**base_payload, "remaining_portions": 0, "prepared_at": "2024-01-02T12:00:00Z"},
    )
    assert second_response.status_code == 201
    third_response = client.post(
        "/api/stored_food/",
        json={**base_payload, "user_id": "other-user", "prepared_at": "2024-01-01T08:00:00Z"},
    )
    assert third_response.status_code == 201

    response = client.get("/api/stored_food/", params={"user_id": "user-2", "only_available": True})
    assert response.status_code == 200
    entries = response.json()
    assert len(entries) == 1
    assert entries[0]["id"] == first["id"]

    response = client.get(
        "/api/stored_food/",
        params={"user_id": "user-2", "day": date(2024, 1, 1).isoformat()},
    )
    assert response.status_code == 200
    ids = {entry["id"] for entry in response.json()}
    assert ids == {first["id"]}


def test_consume_stored_food(client: TestClient, engine) -> None:
    with Session(engine) as session:
        ingredient = _create_ingredient(session, "Roasted Veggies")

    payload = {
        "user_id": "user-3",
        "ingredient_id": ingredient.id,
        "prepared_portions": 3,
        "per_portion_calories": 150,
        "per_portion_protein": 5,
        "per_portion_carbohydrates": 20,
        "per_portion_fat": 6,
        "per_portion_fiber": 4,
    }

    stored = client.post("/api/stored_food/", json=payload).json()

    consume_response = client.post(
        f"/api/stored_food/{stored['id']}/consume", json={"portions": 1.5}
    )
    assert consume_response.status_code == 200
    consumed = consume_response.json()
    assert consumed["remaining_portions"] == 1.5
    assert consumed["is_finished"] is False

    finish_response = client.post(
        f"/api/stored_food/{stored['id']}/consume", json={"portions": 1.5}
    )
    assert finish_response.status_code == 200
    finished = finish_response.json()
    assert finished["remaining_portions"] == 0
    assert finished["is_finished"] is True
    assert finished["completed_at"] is not None


def test_consume_stored_food_rejects_overconsumption(
    client: TestClient, engine
) -> None:
    with Session(engine) as session:
        ingredient = _create_ingredient(session, "Mashed Potatoes")

    payload = {
        "user_id": "user-4",
        "ingredient_id": ingredient.id,
        "prepared_portions": 2,
        "per_portion_calories": 120,
        "per_portion_protein": 4,
        "per_portion_carbohydrates": 18,
        "per_portion_fat": 3,
        "per_portion_fiber": 2,
    }

    stored = client.post("/api/stored_food/", json=payload).json()

    response = client.post(
        f"/api/stored_food/{stored['id']}/consume", json={"portions": 3}
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Cannot consume more portions than remain"


def test_create_stored_food_rejects_negative_macros(
    client: TestClient, engine
) -> None:
    with Session(engine) as session:
        ingredient = _create_ingredient(session, "Tempeh")

    payload = {
        "user_id": "user-5",
        "ingredient_id": ingredient.id,
        "prepared_portions": 2,
        "per_portion_calories": 200,
        "per_portion_protein": -5,
        "per_portion_carbohydrates": 10,
        "per_portion_fat": 8,
        "per_portion_fiber": 3,
    }

    response = client.post("/api/stored_food/", json=payload)
    assert response.status_code == 422
