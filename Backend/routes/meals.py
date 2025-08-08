from flask import Blueprint, request, jsonify
from db import db

# DB Models
from db_models.meal import Meal as db_Meal
from db_models.meal_ingredient import MealIngredient as db_MealIngredient
from db_models.meal_tag import MealTag as db_MealTag
from db_models.possible_meal_tag import PossibleMealTag as db_PossibleMealTag

# Data Models
from data_models.meal import Meal as data_Meal
from data_models.meal_ingredient import MealIngredient as data_MealIngredient
from data_models.meal_tag import MealTag as data_MealTag

meal_blueprint = Blueprint('meal', __name__)

# ====================================
# ROUTES
# ====================================

@meal_blueprint.route('/meals', methods=['GET'])
def get_all_meals():
    meals = db_Meal.query.all()
    result = [fetch_meal(meal.id).serialize() for meal in meals]
    return jsonify(result)

@meal_blueprint.route('/meals/<int:meal_id>', methods=['GET'])
def get_meal(meal_id):
    meal = fetch_meal(meal_id)
    if not meal:
        return jsonify({'error': 'Meal not found'}), 404
    return jsonify(meal.serialize())

@meal_blueprint.route('/meals/possible_tags', methods=['GET'])
def get_possible_meal_tags():
    tags = db_PossibleMealTag.query.all()
    result = [fetch_possible_meal_tag(tag.id).serialize() for tag in tags]
    return jsonify(result)

@meal_blueprint.route('/meals', methods=['POST'])
def add_meal():
    data = request.json
    name = data.get('name')
    ingredients = data.get('ingredients', [])
    tags = data.get('tags', [])

    if not name or not isinstance(ingredients, list):
        return jsonify({'error': 'Invalid request'}), 400

    new_meal = db_Meal(name=name)
    db.session.add(new_meal)
    db.session.flush()  # Get new_meal.id before committing

    for ing in ingredients:
        db.session.add(db_MealIngredient(
            meal_id=new_meal.id,
            ingredient_id=ing['ingredient_id'],
            unit_id=ing['unit_id'],
            unit_quantity=ing['amount']
        ))

    for tag_id in tags:
        db.session.add(db_MealTag(
            meal_id=new_meal.id,
            tag_id=tag_id
        ))

    db.session.commit()
    return jsonify({'message': 'Meal added successfully', 'id': new_meal.id}), 201

@meal_blueprint.route('/meals/<int:meal_id>', methods=['PUT'])
def update_meal(meal_id):
    data = request.json
    name = data.get('name')
    ingredients = data.get('ingredients', [])
    tags = data.get('tags', [])

    meal = db_Meal.query.get(meal_id)
    if not meal:
        return jsonify({'error': 'Meal not found'}), 404

    meal.name = name or meal.name

    # Clear old ingredients and tags
    db_MealIngredient.query.filter_by(meal_id=meal_id).delete()
    db_MealTag.query.filter_by(meal_id=meal_id).delete()

    # Add new ingredients
    for ing in ingredients:
        db.session.add(db_MealIngredient(
            meal_id=meal_id,
            ingredient_id=ing['ingredient_id'],
            unit_id=ing['unit_id'],
            unit_quantity=ing['amount']
        ))

    # Add new tags
    for tag_id in tags:
        db.session.add(db_MealTag(
            meal_id=meal_id,
            tag_id=tag_id
        ))

    db.session.commit()
    return jsonify({'message': 'Meal updated successfully'}), 200

@meal_blueprint.route('/meals/<int:meal_id>', methods=['DELETE'])
def delete_meal(meal_id):
    meal = db_Meal.query.get(meal_id)
    if not meal:
        return jsonify({'error': 'Meal not found'}), 404

    db_MealIngredient.query.filter_by(meal_id=meal_id).delete()
    db_MealTag.query.filter_by(meal_id=meal_id).delete()
    db.session.delete(meal)
    db.session.commit()

    return jsonify({'message': 'Meal deleted successfully'}), 200


# ====================================
# HELPERS
# ====================================

def fetch_meal(meal_id):
    meal = db_Meal.query.get(meal_id)
    if not meal:
        return None

    ingredients = db_MealIngredient.query.filter_by(meal_id=meal_id).all()
    data_ingredients = [
        data_MealIngredient(
            ingredient_id=ing.ingredient_id,
            meal_id=ing.meal_id,
            unit_id=ing.unit_id,
            amount=ing.unit_quantity
        ) for ing in ingredients
    ]

    tags = db_PossibleMealTag.query\
        .join(db_MealTag, db_PossibleMealTag.id == db_MealTag.tag_id)\
        .filter(db_MealTag.meal_id == meal_id)\
        .all()
    data_tags = [data_MealTag(id=tag.id, name=tag.tag) for tag in tags]

    return data_Meal(
        id=meal.id,
        name=meal.name,
        tags=data_tags,
        ingredients=data_ingredients
    )

def fetch_possible_meal_tag(tag_id):
    tag = db_PossibleMealTag.query.get(tag_id)
    if not tag:
        return None
    return data_MealTag(id=tag.id, name=tag.tag)
