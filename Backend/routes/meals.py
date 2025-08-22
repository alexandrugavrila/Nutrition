from flask import Blueprint, request, jsonify
from pydantic import ValidationError

from db import db
from db_models.meal import Meal as db_Meal
from db_models.meal_ingredient import MealIngredient as db_MealIngredient
from db_models.possible_meal_tag import PossibleMealTag as db_PossibleMealTag
from models import MealModel, PossibleMealTagModel

meal_blueprint = Blueprint('meal', __name__)


@meal_blueprint.route('/meals', methods=['GET'])
def get_all_meals():
    meals = db_Meal.query.all()
    data = [MealModel.model_validate(m).model_dump() for m in meals]
    return jsonify(data)


@meal_blueprint.route('/meals/<int:meal_id>', methods=['GET'])
def get_meal(meal_id):
    meal = db_Meal.query.get(meal_id)
    if not meal:
        return jsonify({'error': 'Meal not found'}), 404
    data = MealModel.model_validate(meal).model_dump()
    return jsonify(data)


@meal_blueprint.route('/meals/possible_tags', methods=['GET'])
def get_possible_meal_tags():
    tags = db_PossibleMealTag.query.all()
    data = [PossibleMealTagModel.model_validate(t).model_dump() for t in tags]
    return jsonify(data)


@meal_blueprint.route('/meals', methods=['POST'])
def add_meal():
    try:
        meal_data = MealModel.model_validate(request.json)
    except ValidationError as e:
        return jsonify({'error': e.errors()}), 400

    meal = db_Meal(name=meal_data.name)

    for mi in meal_data.ingredients:
        meal.ingredients.append(
            db_MealIngredient(
                ingredient_id=mi.ingredient_id,
                unit_id=mi.unit_id,
                unit_quantity=mi.unit_quantity,
            )
        )

    for tag in meal_data.tags:
        if tag.id:
            db_tag = db_PossibleMealTag.query.get(tag.id)
            if db_tag:
                meal.tags.append(db_tag)

    db.session.add(meal)
    db.session.commit()

    data = MealModel.model_validate(meal).model_dump()
    return jsonify(data), 201


@meal_blueprint.route('/meals/<int:meal_id>', methods=['PUT'])
def update_meal(meal_id):
    meal = db_Meal.query.get(meal_id)
    if not meal:
        return jsonify({'error': 'Meal not found'}), 404

    try:
        meal_data = MealModel.model_validate(request.json)
    except ValidationError as e:
        return jsonify({'error': e.errors()}), 400

    meal.name = meal_data.name

    meal.ingredients = []
    for mi in meal_data.ingredients:
        meal.ingredients.append(
            db_MealIngredient(
                ingredient_id=mi.ingredient_id,
                unit_id=mi.unit_id,
                unit_quantity=mi.unit_quantity,
            )
        )

    meal.tags = []
    for tag in meal_data.tags:
        if tag.id:
            db_tag = db_PossibleMealTag.query.get(tag.id)
            if db_tag:
                meal.tags.append(db_tag)

    db.session.commit()

    data = MealModel.model_validate(meal).model_dump()
    return jsonify(data), 200


@meal_blueprint.route('/meals/<int:meal_id>', methods=['DELETE'])
def delete_meal(meal_id):
    meal = db_Meal.query.get(meal_id)
    if not meal:
        return jsonify({'error': 'Meal not found'}), 404
    db.session.delete(meal)
    db.session.commit()
    return jsonify({'message': 'Meal deleted successfully'}), 200

