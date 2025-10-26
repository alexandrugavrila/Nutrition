from typing import Any, Dict


def sample_payload() -> Dict[str, Any]:
    return {
        "days": 2,
        "targetMacros": {
            "calories": 2000,
            "protein": 150,
            "carbs": 250,
            "fat": 70,
            "fiber": 30,
        },
        "plan": [
            {
                "type": "food",
                "foodId": "1",
                "portions": 2,
                "overrides": {},
            }
        ],
    }


def test_create_and_get_plan(client):
    payload = {"label": "Weekday", "payload": sample_payload()}

    create_response = client.post("/api/plans/", json=payload)
    assert create_response.status_code == 201
    created = create_response.json()

    assert created["label"] == "Weekday"
    assert created["payload"]["days"] == 2
    plan_id = created["id"]

    get_response = client.get(f"/api/plans/{plan_id}")
    assert get_response.status_code == 200
    fetched = get_response.json()
    assert fetched["label"] == "Weekday"
    assert fetched["payload"] == created["payload"]


def test_update_plan(client):
    create_response = client.post(
        "/api/plans/", json={"label": "Original", "payload": sample_payload()}
    )
    plan_id = create_response.json()["id"]

    updated_payload = sample_payload()
    updated_payload["days"] = 3
    update_response = client.put(
        f"/api/plans/{plan_id}", json={"label": "Updated", "payload": updated_payload}
    )
    assert update_response.status_code == 200
    updated = update_response.json()
    assert updated["label"] == "Updated"
    assert updated["payload"]["days"] == 3


def test_delete_plan(client):
    create_response = client.post(
        "/api/plans/", json={"label": "To Delete", "payload": sample_payload()}
    )
    plan_id = create_response.json()["id"]

    delete_response = client.delete(f"/api/plans/{plan_id}")
    assert delete_response.status_code == 204

    get_response = client.get(f"/api/plans/{plan_id}")
    assert get_response.status_code == 404


def test_list_plans(client):
    plan_a = client.post("/api/plans/", json={"label": "Plan A", "payload": sample_payload()})
    plan_b = client.post("/api/plans/", json={"label": "Plan B", "payload": sample_payload()})

    plan_a_id = plan_a.json()["id"]
    plan_b_id = plan_b.json()["id"]

    updated_payload = sample_payload()
    updated_payload["days"] = 3
    update_response = client.put(
        f"/api/plans/{plan_a_id}",
        json={"label": "Plan A Updated", "payload": updated_payload},
    )
    assert update_response.status_code == 200

    list_response = client.get("/api/plans/")
    assert list_response.status_code == 200
    data = list_response.json()
    assert len(data) == 2

    assert [item["id"] for item in data] == [plan_a_id, plan_b_id]
    assert data[0]["updated_at"] >= data[1]["updated_at"]

    labels = [item["label"] for item in data]
    assert labels[0] == "Plan A Updated"
    assert "Plan B" in labels
