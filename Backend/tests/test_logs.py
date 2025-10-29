from datetime import date

from fastapi.testclient import TestClient
from sqlmodel import Session

from Backend.models import DailyLogEntry, Ingredient, StoredFood


def _create_ingredient(session: Session, name: str = "Ingredient") -> Ingredient:
    ingredient = Ingredient(name=name)
    session.add(ingredient)
    session.commit()
    session.refresh(ingredient)
    return ingredient


def test_create_and_list_daily_logs(client: TestClient, engine) -> None:
    with Session(engine) as session:
        ingredient = _create_ingredient(session, "Shredded Chicken")

    stored_payload = {
        "user_id": "user-logs",
        "ingredient_id": ingredient.id,
        "prepared_portions": 5,
        "per_portion_calories": 200,
        "per_portion_protein": 30,
        "per_portion_carbohydrates": 8,
        "per_portion_fat": 5,
        "per_portion_fiber": 2,
    }

    stored_response = client.post("/api/stored_food/", json=stored_payload)
    assert stored_response.status_code == 201
    stored_data = stored_response.json()

    consume_response = client.post(
        f"/api/stored_food/{stored_data['id']}/consume", json={"portions": 2}
    )
    assert consume_response.status_code == 200
    consumed = consume_response.json()
    assert consumed["remaining_portions"] == 3

    log_date = date(2024, 1, 20)
    log_payload = {
        "user_id": stored_payload["user_id"],
        "log_date": log_date.isoformat(),
        "stored_food_id": stored_data["id"],
        "portions_consumed": 2,
        "calories": 400,
        "protein": 60,
        "carbohydrates": 16,
        "fat": 10,
        "fiber": 4,
    }

    log_response = client.post("/api/logs/", json=log_payload)
    assert log_response.status_code == 201
    log_entry = log_response.json()
    assert log_entry["id"] is not None
    assert log_entry["stored_food_id"] == stored_data["id"]
    assert log_entry["portions_consumed"] == 2
    assert log_entry["calories"] == 400

    list_response = client.get(
        f"/api/logs/{log_date.isoformat()}", params={"user_id": stored_payload["user_id"]}
    )
    assert list_response.status_code == 200
    entries = list_response.json()
    assert len(entries) == 1
    assert entries[0]["id"] == log_entry["id"]
    assert entries[0]["fiber"] == 4

    with Session(engine) as session:
        stored_instance = session.get(StoredFood, stored_data["id"])
        assert stored_instance is not None
        assert stored_instance.remaining_portions == 3

        persisted_log = session.get(DailyLogEntry, log_entry["id"])
        assert persisted_log is not None
        assert persisted_log.calories == 400


def test_daily_log_rejects_negative_macros(client: TestClient, engine) -> None:
    with Session(engine) as session:
        ingredient = _create_ingredient(session, "Steamed Greens")

    stored_payload = {
        "user_id": "user-neg-macros",
        "ingredient_id": ingredient.id,
        "prepared_portions": 2,
        "per_portion_calories": 80,
        "per_portion_protein": 3,
        "per_portion_carbohydrates": 10,
        "per_portion_fat": 1,
        "per_portion_fiber": 4,
    }

    stored_response = client.post("/api/stored_food/", json=stored_payload)
    assert stored_response.status_code == 201
    stored_data = stored_response.json()

    consume_response = client.post(
        f"/api/stored_food/{stored_data['id']}/consume", json={"portions": 1}
    )
    assert consume_response.status_code == 200

    log_payload = {
        "user_id": stored_payload["user_id"],
        "log_date": date(2024, 2, 1).isoformat(),
        "stored_food_id": stored_data["id"],
        "portions_consumed": 1,
        "calories": -50,
        "protein": 3,
        "carbohydrates": 10,
        "fat": 1,
        "fiber": 4,
    }

    response = client.post("/api/logs/", json=log_payload)
    assert response.status_code == 422
