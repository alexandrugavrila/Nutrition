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


def test_usda_sync_disabled_before_database_or_input_access(monkeypatch):
    import pytest
    import Backend.commands.sync_usda_foundation as command
    def forbidden(*args, **kwargs):
        raise AssertionError("Disabled synchronization must perform no I/O")
    monkeypatch.setattr(command, "_load_payload", forbidden)
    monkeypatch.setattr(command, "Session", forbidden)
    monkeypatch.setattr("sys.argv", ["sync", "--input", "https://example.invalid/input.json", "--mark-stale"])
    with pytest.raises(SystemExit, match="disabled"):
        command.main()
    with pytest.raises(ValueError, match="disabled"):
        command.sync_usda_foundation(object(), object(), mark_stale=True)


def test_unit_helper_retains_referenced_legacy_alias(engine, user_a_client):
    from Backend.commands.sync_usda_foundation import _sync_units
    from Backend.models import IngredientUnit
    with Session(engine) as session:
        ingredient = Ingredient(name="Personal", user_id="user-a", units=[IngredientUnit(name="1 g", grams=1), IngredientUnit(name="g", grams=1)])
        session.add(ingredient); session.flush()
        alias = ingredient.units[0].id
        food = Food(name="Recipe", user_id="user-a", ingredients=[FoodIngredient(ingredient_id=ingredient.id, unit_id=alias, unit_quantity=50)])
        session.add(food); session.commit()
        _sync_units(ingredient, [{"name":"g", "grams":1}])
        session.commit()
        assert food.ingredients[0].unit_id == alias
        assert session.get(IngredientUnit, alias).name == "1 g"
        assert len(ingredient.units) == 2


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
