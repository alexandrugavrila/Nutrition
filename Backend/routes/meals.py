from flask import Flask, Blueprint, request, jsonify
from pprint import pprint

from db import db
from db_models.meal import Meal as db_Meal
from db_models.meal_ingredient import MealIngredient as db_MealIngredient
from db_models.meal_tag import MealTag as db_MealTag
from db_models.possible_meal_tag import PossibleMealTag as db_PossibleMealTag
from db_models.ingredient import Ingredient as db_Ingredient
from db_models.nutrition import Nutrition as db_Nutrition
from db_models.ingredient_unit import IngredientUnit as db_IngredientUnit
from db_models.possible_ingredient_tag import PossibleIngredientTag as db_PossibleIngredientTag
from db_models.ingredient_tag import IngredientTag as db_IngredientTag

from data_models.meal import Meal as data_Meal
from data_models.meal_ingredient import MealIngredient as data_MealIngredient
from data_models.meal_tag import MealTag as data_MealTag
from data_models.ingredient import Ingredient as data_Ingredient
from data_models.nutrition import Nutrition as data_Nutrition
from data_models.ingredient_unit import IngredientUnit as data_IngredientUnit

from routes.ingredients import fetch_ingredient


meal_blueprint = Blueprint('meal', __name__)


@meal_blueprint.route('/meals', methods=['GET'])
def get_all_meals():
    meals = db_Meal.query.all()
    result = []
    for meal in meals:
        result.append(fetch_meal(meal.id).serialize())
    return jsonify(result)


@meal_blueprint.route('/meals/<int:meal_id>', methods=['GET'])
def get_meal(meal_id):
    meal = fetch_meal(meal_id)
    if not meal:
        return jsonify({'error': 'Meal not found'}), 404
    return jsonify(meal.serialize())







# @meal_blueprint.route('/meals', methods=['POST'])
# def add_meal():
#     data = request.json
#     name = data.get('name')
#     description = data.get('description')
#     ingredients = data.get('ingredients')

#     # Create a new meal
#     new_meal = db__Meal(name=name, description=description)
#     db.session.add(new_meal)
#     db.session.commit()

#     # Add ingredients to the meal
#     for ingredient in ingredients:
#         meal_ingredient = db_MealIngredient(
#             meal_id=new_meal.id,
#             ingredient_id=ingredient['id'],
#             ingredient_quantity=ingredient['quantity']
#         )
#         db.session.add(meal_ingredient)
#         db.session.commit()

#     return jsonify({'message': 'Meal added successfully'}), 201


# @meal_blueprint.route('/meals/<int:meal_id>', methods=['PUT'])
# def update_meal(meal_id):
#     data = request.json
#     name = data.get('name')
#     description = data.get('description')
#     ingredients = data.get('ingredients')

#     # Retrieve the meal by ID
#     meal = db__Meal.query.get(meal_id)
#     if not meal:
#         return jsonify({'error': 'Meal not found'}), 404

#     # Update meal name and description
#     meal.name = name
#     meal.description = description

#     # Update meal ingredients
#     db_MealIngredient.query.filter_by(meal_id=meal_id).delete()
#     db.session.commit()

#     for ingredient in ingredients:
#         meal_ingredient = db_MealIngredient(
#             meal_id=meal_id,
#             ingredient_id=ingredient['id'],
#             ingredient_quantity=ingredient['quantity']
#         )
#         db.session.add(meal_ingredient)
#         db.session.commit()

#     return jsonify({'message': 'Meal updated successfully'}), 200


# @meal_blueprint.route('/meals/<int:meal_id>', methods=['DELETE'])
# def delete_meal(meal_id):
#     meal = db__Meal.query.get(meal_id)
#     if not meal:
#         return jsonify({'error': 'Meal not found'}), 404

#     db_MealIngredient.query.filter_by(meal_id=meal_id).delete()
#     db.session.delete(meal)
#     db.session.commit()

#     return jsonify({'message': 'Meal deleted successfully'}), 200


# Meal Tag Routes
@meal_blueprint.route('/meals/possible_tags', methods=['GET'])
def get_possible_meal_tags():
    tags = db_PossibleMealTag.query.all()
    result = []
    for tag in tags:
        result.append(fetch_possible_meal_tag(tag.id).serialize())
    return jsonify(result)


# Helper functions
def fetch_meal(meal_id):
    meal = db.session.query(db_Meal)\
        .filter_by(id=meal_id)\
        .first()
    if meal is None: return None

    ingredients_data = db.session.query(db_MealIngredient)\
        .filter_by(meal_id=meal_id)\
        .all()
    new_ingredients = [data_MealIngredient(
        ingredient_id=ingredient.ingredient_id,
        meal_id=ingredient.meal_id,
        unit_id=ingredient.unit_id,
        amount=ingredient.unit_quantity
        ) for ingredient in ingredients_data]

    tags_data = db.session.query(db_PossibleMealTag)\
        .join(db_MealTag, db_PossibleMealTag.id == db_MealTag.tag_id)\
        .filter(db_MealTag.meal_id == meal_id)\
        .all()
    new_tags = [data_MealTag(
        id=tag.id, 
        name=tag.tag
        ) for tag in tags_data]

    newMeal = data_Meal(
        meal.id, 
        meal.name, 
        new_tags, 
        new_ingredients)

    return newMeal

def fetch_possible_meal_tag(tag_id):
    tag = db_PossibleMealTag.query.get(tag_id)
    if tag is None: return None
    return data_MealTag(tag.id, tag.tag)

