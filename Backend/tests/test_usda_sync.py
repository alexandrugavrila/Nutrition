import json
import zipfile
from pathlib import Path

from sqlmodel import Session, select

from Backend.commands.convert_usda_foundation_manifest import main as convert_manifest_main
from Backend.commands.sync_usda_foundation import _load_payload, sync_usda_foundation
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


def test_usda_sync_loads_zipped_json(tmp_path) -> None:
    archive_path = tmp_path / "foundation.zip"
    expected = _food_payload(400, "Zipped Food")
    with zipfile.ZipFile(archive_path, "w") as archive:
        archive.writestr("FoodData_Central_foundation_food_json.json", json.dumps(expected))

    assert _load_payload(str(archive_path)) == expected


def test_usda_manifest_converter_writes_usda_ingredients(tmp_path, monkeypatch) -> None:
    archive_path = tmp_path / "foundation.zip"
    manifest_path = tmp_path / "starter.json"
    expected = _food_payload(500, "Manifest Food")
    with zipfile.ZipFile(archive_path, "w") as archive:
        archive.writestr("FoodData_Central_foundation_food_json.json", json.dumps(expected))
    manifest_path.write_text(
        json.dumps({"version": 1, "catalog_ingredients": [{"slug": "old"}]}),
        encoding="utf-8",
    )

    monkeypatch.setattr(
        "sys.argv",
        [
            "convert-usda",
            "--input",
            str(archive_path),
            "--manifest",
            str(manifest_path),
        ],
    )

    assert convert_manifest_main() == 0
    manifest = json.loads(Path(manifest_path).read_text(encoding="utf-8"))
    assert "catalog_ingredients" not in manifest
    assert manifest["usda_ingredients"] == [
        {
            "slug": "usda-500",
            "name": "Manifest Food",
            "source": "usda",
            "source_id": "500",
        }
    ]
