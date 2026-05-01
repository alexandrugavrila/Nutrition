from sqlmodel import Session, select

from Backend.commands.sync_usda_foundation import sync_usda_foundation
from Backend.models import Food, FoodIngredient, Ingredient, IngredientSource


def _food_payload(fdc_id: int, description: str, protein: float = 1.0) -> dict:
    return {
        "FoundationFoods": [
            {
                "fdcId": fdc_id,
                "description": description,
                "dataType": "Foundation",
                "foodNutrients": [
                    {"nutrientId": 1008, "nutrientName": "Energy", "unitName": "kcal", "value": 100},
                    {"nutrientId": 1003, "nutrientName": "Protein", "unitName": "g", "value": protein},
                    {"nutrientId": 1004, "nutrientName": "Total lipid (fat)", "unitName": "g", "value": 2},
                    {"nutrientId": 1005, "nutrientName": "Carbohydrate, by difference", "unitName": "g", "value": 3},
                    {"nutrientId": 1079, "nutrientName": "Fiber, total dietary", "unitName": "g", "value": 4},
                ],
                "foodPortions": [],
            }
        ]
    }


def test_usda_sync_upserts_global_ingredients(engine) -> None:
    with Session(engine) as session:
        first = sync_usda_foundation(session, _food_payload(100, "Sample Banana"))
        session.commit()
        assert first["created"] == 1

        ingredient = session.exec(select(Ingredient)).one()
        assert ingredient.user_id is None
        assert ingredient.name == "Sample Banana"
        assert ingredient.nutrition is not None
        assert ingredient.nutrition.protein == 0.01

        second = sync_usda_foundation(session, _food_payload(100, "Sample Banana Updated", 2.0))
        session.commit()
        assert second["updated"] == 1

        source = session.exec(select(IngredientSource)).one()
        session.refresh(ingredient)
        assert ingredient.name == "Sample Banana Updated"
        assert ingredient.nutrition.protein == 0.02
        assert source.source == "usda"
        assert source.source_id == "100"
        assert source.payload_hash


def test_usda_sync_marks_missing_sources_stale(engine) -> None:
    with Session(engine) as session:
        sync_usda_foundation(session, _food_payload(200, "Keep Me"))
        session.commit()

        summary = sync_usda_foundation(session, {"FoundationFoods": []}, mark_stale=True)
        session.commit()

        source = session.exec(select(IngredientSource)).one()
        assert summary["stale"] == 1
        assert source.is_stale is True


def test_usda_sync_preserves_referenced_units(engine) -> None:
    with Session(engine) as session:
        sync_usda_foundation(session, _food_payload(300, "Referenced Food"))
        session.commit()

        ingredient = session.exec(select(Ingredient)).one()
        unit = next(unit for unit in ingredient.units if unit.name == "g")
        food = Food(
            user_id=None,
            name="Food Using USDA Unit",
            ingredients=[
                FoodIngredient(
                    ingredient_id=ingredient.id,
                    unit_id=unit.id,
                    unit_quantity=50,
                )
            ],
        )
        session.add(food)
        session.commit()

        summary = sync_usda_foundation(
            session, _food_payload(300, "Referenced Food Updated", 3.0)
        )
        session.commit()

        session.refresh(food)
        session.refresh(ingredient)
        assert summary["updated"] == 1
        assert food.ingredients[0].unit_id == unit.id
        assert any(existing_unit.id == unit.id for existing_unit in ingredient.units)
