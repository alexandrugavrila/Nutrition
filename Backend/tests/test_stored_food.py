from datetime import date

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from Backend.models import DailyLogEntry, Ingredient, StoredFood


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


def test_list_stored_food_handles_missing_table(
    client: TestClient, engine
) -> None:
    with Session(engine) as session:
        ingredient = _create_ingredient(session, "Quinoa")

    # Drop the stored_food table to emulate an out-of-date database schema.
    StoredFood.__table__.drop(engine)

    response = client.get("/api/stored_food/")
    assert response.status_code == 200
    assert response.json() == []

    # Recreate the table so other operations in this test can verify behavior.
    StoredFood.__table__.create(engine)

    payload = {
        "user_id": "user-migration",
        "ingredient_id": ingredient.id,
        "prepared_portions": 1,
        "per_portion_calories": 100,
        "per_portion_protein": 10,
        "per_portion_carbohydrates": 5,
        "per_portion_fat": 2,
        "per_portion_fiber": 1,
    }

    response = client.post("/api/stored_food/", json=payload)
    assert response.status_code == 201


def test_create_stored_food_reports_missing_table(
    client: TestClient, engine
) -> None:
    with Session(engine) as session:
        ingredient = _create_ingredient(session, "Tofu")

    StoredFood.__table__.drop(engine)

    payload = {
        "user_id": "user-missing",
        "ingredient_id": ingredient.id,
        "prepared_portions": 2,
        "per_portion_calories": 150,
        "per_portion_protein": 12,
        "per_portion_carbohydrates": 6,
        "per_portion_fat": 3,
        "per_portion_fiber": 4,
    }

    response = client.post("/api/stored_food/", json=payload)
    assert response.status_code == 503
    assert "Run the latest database migrations" in response.json()["detail"]


def test_consume_stored_food_reports_missing_table(
    client: TestClient, engine
) -> None:
    with Session(engine) as session:
        ingredient = _create_ingredient(session, "Beans")

    payload = {
        "user_id": "user-consume",
        "ingredient_id": ingredient.id,
        "prepared_portions": 2,
        "per_portion_calories": 150,
        "per_portion_protein": 9,
        "per_portion_carbohydrates": 12,
        "per_portion_fat": 4,
        "per_portion_fiber": 6,
    }

    created = client.post("/api/stored_food/", json=payload)
    assert created.status_code == 201
    stored_id = created.json()["id"]

    StoredFood.__table__.drop(engine)

    response = client.post(
        f"/api/stored_food/{stored_id}/consume", json={"portions": 1}
    )
    assert response.status_code == 503
    assert "Run the latest database migrations" in response.json()["detail"]


def test_delete_stored_food_entry(client: TestClient, engine) -> None:
    with Session(engine) as session:
        ingredient = _create_ingredient(session, "Black Beans")

    payload = {
        "user_id": "user-delete-stored",
        "ingredient_id": ingredient.id,
        "prepared_portions": 3,
        "per_portion_calories": 180,
        "per_portion_protein": 10,
        "per_portion_carbohydrates": 20,
        "per_portion_fat": 4,
        "per_portion_fiber": 8,
    }

    stored_response = client.post("/api/stored_food/", json=payload)
    assert stored_response.status_code == 201
    stored_id = stored_response.json()["id"]

    other_response = client.post(
        "/api/stored_food/",
        json={**payload, "user_id": "other-user"},
    )
    assert other_response.status_code == 201

    delete_response = client.delete(f"/api/stored_food/{stored_id}")
    assert delete_response.status_code == 204

    with Session(engine) as session:
        removed = session.get(StoredFood, stored_id)
        assert removed is None
        remaining = session.exec(
            select(StoredFood).where(StoredFood.user_id == "other-user")
        ).all()
        assert len(remaining) == 1


def test_delete_stored_food_preserves_daily_logs(client: TestClient, engine) -> None:
    with Session(engine) as session:
        ingredient = _create_ingredient(session, "Chili")

    stored_payload = {
        "user_id": "user-log-retain",
        "ingredient_id": ingredient.id,
        "prepared_portions": 5,
        "per_portion_calories": 300,
        "per_portion_protein": 20,
        "per_portion_carbohydrates": 25,
        "per_portion_fat": 12,
        "per_portion_fiber": 9,
    }

    stored_response = client.post("/api/stored_food/", json=stored_payload)
    assert stored_response.status_code == 201
    stored_id = stored_response.json()["id"]

    log_payload = {
        "user_id": stored_payload["user_id"],
        "log_date": "2024-01-15",
        "stored_food_id": stored_id,
        "portions_consumed": 1,
        "calories": stored_payload["per_portion_calories"],
        "protein": stored_payload["per_portion_protein"],
        "carbohydrates": stored_payload["per_portion_carbohydrates"],
        "fat": stored_payload["per_portion_fat"],
        "fiber": stored_payload["per_portion_fiber"],
    }

    log_response = client.post("/api/logs/", json=log_payload)
    assert log_response.status_code == 201
    log_id = log_response.json()["id"]

    delete_response = client.delete(f"/api/stored_food/{stored_id}")
    assert delete_response.status_code == 204

    with Session(engine) as session:
        entry = session.get(DailyLogEntry, log_id)
        assert entry is not None
        assert entry.stored_food_id is None
        assert entry.ingredient_id == ingredient.id
        assert entry.food_id is None


def test_clear_stored_food(client: TestClient, engine) -> None:
    with Session(engine) as session:
        ingredient = _create_ingredient(session, "Tomato Soup")

    payload = {
        "user_id": "user-clear-stored",
        "ingredient_id": ingredient.id,
        "prepared_portions": 4,
        "per_portion_calories": 120,
        "per_portion_protein": 6,
        "per_portion_carbohydrates": 14,
        "per_portion_fat": 3,
        "per_portion_fiber": 5,
    }

    first_response = client.post("/api/stored_food/", json=payload)
    assert first_response.status_code == 201

    second_response = client.post(
        "/api/stored_food/", json={**payload, "label": "Leftovers"}
    )
    assert second_response.status_code == 201

    other_response = client.post(
        "/api/stored_food/", json={**payload, "user_id": "other-user"}
    )
    assert other_response.status_code == 201

    clear_response = client.delete(
        "/api/stored_food/", params={"user_id": payload["user_id"]}
    )
    assert clear_response.status_code == 204

    with Session(engine) as session:
        remaining = session.exec(
            select(StoredFood).where(StoredFood.user_id == payload["user_id"])
        ).all()
        assert remaining == []

        others = session.exec(
            select(StoredFood).where(StoredFood.user_id == "other-user")
        ).all()
        assert len(others) == 1
