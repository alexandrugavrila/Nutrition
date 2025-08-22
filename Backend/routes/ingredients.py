from flask import Blueprint, request, jsonify
from pydantic import ValidationError

from db import db
from db_models.ingredient import Ingredient as db_Ingredient
from db_models.nutrition import Nutrition as db_Nutrition
from db_models.ingredient_unit import IngredientUnit as db_IngredientUnit
from db_models.possible_ingredient_tag import PossibleIngredientTag as db_PossibleIngredientTag
from models import IngredientModel, PossibleIngredientTagModel

ingredient_blueprint = Blueprint('ingredient', __name__)


@ingredient_blueprint.route('/ingredients', methods=['GET'])
def get_all_ingredients():
    ingredients = db_Ingredient.query.all()
    data = [IngredientModel.model_validate(i).model_dump() for i in ingredients]
    return jsonify(data)


@ingredient_blueprint.route('/ingredients/<int:ingredient_id>', methods=['GET'])
def get_ingredient(ingredient_id):
    ingredient = db_Ingredient.query.get(ingredient_id)
    if not ingredient:
        return jsonify({'error': 'Ingredient not found'}), 404
    data = IngredientModel.model_validate(ingredient).model_dump()
    return jsonify(data)


@ingredient_blueprint.route('/ingredients', methods=['POST'])
def add_ingredient():
    try:
        ingredient_data = IngredientModel.model_validate(request.json)
    except ValidationError as e:
        return jsonify({'error': e.errors()}), 400

    ingredient = db_Ingredient(name=ingredient_data.name)

    if ingredient_data.nutrition:
        n = ingredient_data.nutrition
        ingredient.nutrition = db_Nutrition(
            calories=n.calories,
            fat=n.fat,
            carbohydrates=n.carbohydrates,
            protein=n.protein,
            fiber=n.fiber,
        )

    for unit in ingredient_data.units:
        ingredient.units.append(
            db_IngredientUnit(name=unit.name, grams=unit.grams)
        )

    for tag in ingredient_data.tags:
        if tag.id:
            db_tag = db_PossibleIngredientTag.query.get(tag.id)
            if db_tag:
                ingredient.tags.append(db_tag)

    db.session.add(ingredient)
    db.session.commit()

    data = IngredientModel.model_validate(ingredient).model_dump()
    return jsonify(data), 201


@ingredient_blueprint.route('/ingredients/<int:ingredient_id>', methods=['PUT'])
def update_ingredient(ingredient_id):
    ingredient = db_Ingredient.query.get(ingredient_id)
    if not ingredient:
        return jsonify({'error': 'Ingredient not found'}), 404

    try:
        ingredient_data = IngredientModel.model_validate(request.json)
    except ValidationError as e:
        return jsonify({'error': e.errors()}), 400

    ingredient.name = ingredient_data.name

    if ingredient_data.nutrition:
        n = ingredient_data.nutrition
        if ingredient.nutrition:
            ingredient.nutrition.calories = n.calories
            ingredient.nutrition.fat = n.fat
            ingredient.nutrition.carbohydrates = n.carbohydrates
            ingredient.nutrition.protein = n.protein
            ingredient.nutrition.fiber = n.fiber
        else:
            ingredient.nutrition = db_Nutrition(
                calories=n.calories,
                fat=n.fat,
                carbohydrates=n.carbohydrates,
                protein=n.protein,
                fiber=n.fiber,
            )

    ingredient.units = []
    for unit in ingredient_data.units:
        ingredient.units.append(
            db_IngredientUnit(name=unit.name, grams=unit.grams)
        )

    ingredient.tags = []
    for tag in ingredient_data.tags:
        if tag.id:
            db_tag = db_PossibleIngredientTag.query.get(tag.id)
            if db_tag:
                ingredient.tags.append(db_tag)

    db.session.commit()

    data = IngredientModel.model_validate(ingredient).model_dump()
    return jsonify(data), 200


@ingredient_blueprint.route('/ingredients/<int:ingredient_id>', methods=['DELETE'])
def delete_ingredient(ingredient_id):
    ingredient = db_Ingredient.query.get(ingredient_id)
    if not ingredient:
        return jsonify({'error': 'Ingredient not found'}), 404
    db.session.delete(ingredient)
    db.session.commit()
    return jsonify({'message': 'Ingredient deleted successfully'}), 200


@ingredient_blueprint.route('/ingredients/possible_tags', methods=['GET'])
def get_all_possible_tags():
    tags = db_PossibleIngredientTag.query.all()
    data = [PossibleIngredientTagModel.model_validate(t).model_dump() for t in tags]
    return jsonify(data)
