from flask import Flask, Blueprint, request, jsonify
from pprint import pprint

from db import db
from db_models.ingredient import Ingredient as db_Ingredient
from db_models.nutrition import Nutrition as db_Nutrition
from db_models.ingredient_unit import IngredientUnit as db_IngredientUnit
from db_models.ingredient_tag import IngredientTag as db_IngredientTag
from db_models.possible_ingredient_tag import PossibleIngredientTag as db_PossibleIngredientTag

from data_models.ingredient import Ingredient as data_Ingredient
from data_models.ingredient_unit import IngredientUnit as data_IngredientUnit
from data_models.nutrition import Nutrition as data_Nutrition
from data_models.ingredient_tag import IngredientTag as data_IngredientTag

ingredient_blueprint = Blueprint('ingredient', __name__)

# Ingredient Routes
@ingredient_blueprint.route('/ingredients', methods=['GET'])
def get_all_ingredients():
    ingredients = db_Ingredient.query.all()
    result = []
    for ingredient in ingredients:
        result.append(fetch_ingredient(ingredient.id).serialize())
    return jsonify(result)

@ingredient_blueprint.route('/ingredients/<int:ingredient_id>', methods=['GET'])
def get_ingredient(ingredient_id):
    ingredient = fetch_ingredient(ingredient_id)
    if not ingredient:
        return jsonify({'error': 'Ingredient not found'}), 404

    return jsonify(ingredient.serialize())

@ingredient_blueprint.route('/ingredients', methods=['POST'])
def add_ingredient():
    print("\n\n")
    pprint(request.json)
    print("\n\n")
    data = request.json
    name = data.get('name')
    units_data = data.get('units', [])
    nutrition = data.get('nutrition')
    tags = data.get('tags', [])

    # Create a new ingredient
    new_ingredient = db_Ingredient(name=name)
    db.session.add(new_ingredient)
    db.session.commit()  # Have to comit here to get new ingredient ID

    # Create corresponding nutrition entry
    new_nutrition = db_Nutrition(
        ingredient_id=new_ingredient.id,
        calories=nutrition['calories'],
        fat=nutrition['fat'],
        carbohydrates=nutrition['carbohydrates'],
        protein=nutrition['protein'],
        fiber=nutrition['fiber']
    )
    db.session.add(new_nutrition)

    for unit in units_data:
        unit = db_IngredientUnit(ingredient_id=new_ingredient.id, name=unit["name"], grams=unit["grams"])
        db.session.add(unit)

    for tag in tags:
        tag = db_IngredientTag(ingredient_id=new_ingredient.id, tag_id=tag["id"])
        db.session.add(tag)

    db.session.commit()

    return jsonify({'message': 'Ingredient added successfully'}), 201

@ingredient_blueprint.route('/ingredients/<int:ingredient_id>', methods=['PUT'])
def update_ingredient(ingredient_id):
    print("\n\n")
    pprint(request.json)
    print("\n\n")
    data = request.json
    name = data.get('name')
    units_data = data.get('units', [])
    nutrition_data = data.get('nutrition')
    tags_data = data.get('tags', [])

    # Retrieve the ingredient by ID
    ingredient = db_Ingredient.query.get(ingredient_id)
    if not ingredient:
        return jsonify({'error': 'Ingredient not found'}), 404

    # Update ingredient name
    ingredient.name = name

    # Update nutrition data
    nutrition = db_Nutrition.query.filter_by(ingredient_id=ingredient_id).first()
    if not nutrition:
        return jsonify({'error': 'Nutrition data not found'}), 404

    nutrition.calories = nutrition_data['calories']
    nutrition.fat = nutrition_data['fat']
    nutrition.carbohydrates = nutrition_data['carbohydrates']
    nutrition.protein = nutrition_data['protein']
    nutrition.fiber = nutrition_data['fiber']

    # Update ingredient units
    db_IngredientUnit.query.filter_by(ingredient_id=ingredient_id).delete()
    for unit in units_data:
        unit = db_IngredientUnit(ingredient_id=ingredient.id, name=unit["name"], grams=unit["grams"])
        db.session.add(unit)

    # Update tags
    db_IngredientTag.query.filter_by(ingredient_id=ingredient_id).delete()
    for tag in tags_data:
        tag = db_IngredientTag(ingredient_id=ingredient.id, tag_id=tag["id"])
        db.session.add(tag)

    db.session.commit()

    return jsonify({'message': 'Ingredient updated successfully'}), 200

@ingredient_blueprint.route('/ingredients/<int:ingredient_id>', methods=['DELETE'])
def delete_ingredient(ingredient_id):
    ingredient = db_Ingredient.query.get(ingredient_id)
    if not ingredient:
        return jsonify({'error': 'Ingredient not found'}), 404

    db_Nutrition.query.filter_by(ingredient_id=ingredient_id).delete()
    db_IngredientUnit.query.filter_by(ingredient_id=ingredient_id).delete()
    db_IngredientTag.query.filter_by(ingredient_id=ingredient_id).delete()
    db.session.delete(ingredient)
    db.session.commit()

    return jsonify({'message': 'Ingredient deleted successfully'}), 200

# Ingredient Tag Routes
@ingredient_blueprint.route('/ingredients/possible_tags', methods=['GET'])
def get_all_possible_tags():
    possible_ingredient_tags = db_PossibleIngredientTag.query.all()
    result = []
    for tag in possible_ingredient_tags:
        result.append(fetch_possible_ingredient_tag(tag.id).serialize())
    return jsonify(result)


# Helper Functions
def fetch_ingredient(ingredient_id):
    ingredient = db.session.query(db_Ingredient, db_Nutrition)\
        .join(db_Nutrition, db_Ingredient.id == db_Nutrition.ingredient_id)\
        .filter(db_Ingredient.id == ingredient_id)\
        .first()
    
    if ingredient is None: return None

    units = db.session.query(db_IngredientUnit)\
        .filter(db_IngredientUnit.ingredient_id == ingredient_id)\
        .all()
    tags = db.session.query(db_PossibleIngredientTag)\
        .join(db_IngredientTag, db_PossibleIngredientTag.id == db_IngredientTag.tag_id)\
        .filter(db_IngredientTag.ingredient_id == ingredient_id)\
        .all()
    

    ingredient_data = ingredient[0]
    nutrition_data = ingredient[1]

    new_units = [data_IngredientUnit(
        id=unit.id, 
        ingredient_id=unit.ingredient_id, 
        name=unit.name, 
        grams=unit.grams
        ) for unit in units]

    new_tags = [data_IngredientTag(
        id=tag.id, 
        name=tag.tag
        ) for tag in tags]

    new_nutrition = data_Nutrition(
        calories=float(nutrition_data.calories),
        fat=float(nutrition_data.fat),
        carbohydrates=float(nutrition_data.carbohydrates),
        protein=float(nutrition_data.protein),
        fiber=float(nutrition_data.fiber)
    )
    new_ingredient = data_Ingredient(
        id=ingredient_data.id,
        name=ingredient_data.name,
        nutrition=new_nutrition,
        units=new_units,
        tags=new_tags
    )

    return new_ingredient

def fetch_possible_ingredient_tag(tag_id):
    tag = db_PossibleIngredientTag.query.get(tag_id)
    if not tag: return None
    return data_IngredientTag(id=tag.id, name=tag.tag)
