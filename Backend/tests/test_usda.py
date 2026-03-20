import pytest

from Backend.routes.usda import _trim_food_payload


@pytest.mark.parametrize(
    ("data_type", "serving_size", "serving_size_unit", "expected_calories", "expected_protein"),
    [
        ("Foundation", None, None, 0.89, 0.0109),
        ("Survey (FNDDS)", None, None, 0.89, 0.0109),
        ("SR Legacy", None, None, 0.89, 0.0109),
        ("Branded", 55, "g", 0.89, 0.0109),
    ],
)
def test_trim_food_payload_normalizes_supported_usda_foods_to_per_gram(
    data_type: str,
    serving_size: float | None,
    serving_size_unit: str | None,
    expected_calories: float,
    expected_protein: float,
) -> None:
    food = {
        "fdcId": 123,
        "description": "Banana sample",
        "dataType": data_type,
        "servingSize": serving_size,
        "servingSizeUnit": serving_size_unit,
        "foodNutrients": [
            {"nutrientName": "Energy", "value": 89},
            {"nutrientName": "Protein", "value": 1.09},
            {"nutrientName": "Total lipid (fat)", "value": 0.33},
            {"nutrientName": "Carbohydrate, by difference", "value": 22.84},
            {"nutrientName": "Fiber, total dietary", "value": 2.6},
        ],
    }

    payload = _trim_food_payload(food)

    assert payload["normalization"] == {
        "data_type": data_type,
        "source_basis": "per_100g",
        "normalized_basis": "per_g",
        "can_normalize": True,
        "reason": None,
        "serving_size": serving_size,
        "serving_size_unit": serving_size_unit,
        "household_serving_full_text": None,
    }
    assert payload["nutrition"] == pytest.approx(
        {
            "calories": expected_calories,
            "protein": expected_protein,
            "fat": 0.0033,
            "carbohydrates": 0.2284,
            "fiber": 0.026,
        }
    )


def test_trim_food_payload_marks_branded_liquids_as_not_normalizable() -> None:
    payload = _trim_food_payload(
        {
            "fdcId": 456,
            "description": "Orange juice sample",
            "dataType": "Branded",
            "servingSize": 240,
            "servingSizeUnit": "ml",
            "householdServingFullText": "8 fl oz",
            "foodNutrients": [
                {"nutrientName": "Energy", "value": 45},
                {"nutrientName": "Protein", "value": 0.8},
            ],
        }
    )

    assert payload["nutrition"] is None
    assert payload["normalization"] == {
        "data_type": "Branded",
        "source_basis": "per_100ml",
        "normalized_basis": None,
        "can_normalize": False,
        "reason": "USDA branded nutrients are standardized to 100 mL for this item, so they cannot be converted to per-gram values without density data.",
        "serving_size": 240.0,
        "serving_size_unit": "ml",
        "household_serving_full_text": "8 fl oz",
    }
