from flask import Blueprint, request, jsonify

from db import db
from db_models.meal import Meal as db_Meal
from db_models.possible_meal_tag import PossibleMealTag as db_PossibleMealTag
from schemas import MealSchema, PossibleMealTagSchema

meal_blueprint = Blueprint('meal', __name__)


meal_schema = MealSchema()
meals_schema = MealSchema(many=True)
possible_meal_tag_schema = PossibleMealTagSchema(many=True)


@meal_blueprint.route('/meals', methods=['GET'])
def get_all_meals():
    meals = db_Meal.query.all()
    return jsonify(meals_schema.dump(meals))


@meal_blueprint.route('/meals/<int:meal_id>', methods=['GET'])
def get_meal(meal_id):
    meal = db_Meal.query.get(meal_id)
    if not meal:
        return jsonify({'error': 'Meal not found'}), 404
    return jsonify(meal_schema.dump(meal))


@meal_blueprint.route('/meals/possible_tags', methods=['GET'])
def get_possible_meal_tags():
    tags = db_PossibleMealTag.query.all()
    return jsonify(possible_meal_tag_schema.dump(tags))


@meal_blueprint.route('/meals', methods=['POST'])
def add_meal():
    meal = meal_schema.load(request.json, session=db.session)
    db.session.add(meal)
    db.session.commit()
    return jsonify(meal_schema.dump(meal)), 201


@meal_blueprint.route('/meals/<int:meal_id>', methods=['PUT'])
def update_meal(meal_id):
    meal = db_Meal.query.get(meal_id)
    if not meal:
        return jsonify({'error': 'Meal not found'}), 404
    meal_schema.load(request.json, instance=meal, session=db.session)
    db.session.commit()
    return jsonify(meal_schema.dump(meal)), 200


@meal_blueprint.route('/meals/<int:meal_id>', methods=['DELETE'])
def delete_meal(meal_id):
    meal = db_Meal.query.get(meal_id)
    if not meal:
        return jsonify({'error': 'Meal not found'}), 404
    db.session.delete(meal)
    db.session.commit()
    return jsonify({'message': 'Meal deleted successfully'}), 200
