from flask import Blueprint, request, jsonify

from db import db
from db_models.ingredient import Ingredient as db_Ingredient
from db_models.possible_ingredient_tag import PossibleIngredientTag as db_PossibleIngredientTag
from schemas import IngredientSchema, PossibleIngredientTagSchema

ingredient_blueprint = Blueprint('ingredient', __name__)


ingredient_schema = IngredientSchema()
ingredients_schema = IngredientSchema(many=True)
possible_tags_schema = PossibleIngredientTagSchema(many=True)


@ingredient_blueprint.route('/ingredients', methods=['GET'])
def get_all_ingredients():
    ingredients = db_Ingredient.query.all()
    return jsonify(ingredients_schema.dump(ingredients))


@ingredient_blueprint.route('/ingredients/<int:ingredient_id>', methods=['GET'])
def get_ingredient(ingredient_id):
    ingredient = db_Ingredient.query.get(ingredient_id)
    if not ingredient:
        return jsonify({'error': 'Ingredient not found'}), 404
    return jsonify(ingredient_schema.dump(ingredient))


@ingredient_blueprint.route('/ingredients', methods=['POST'])
def add_ingredient():
    ingredient = ingredient_schema.load(request.json, session=db.session)
    db.session.add(ingredient)
    db.session.commit()
    return jsonify(ingredient_schema.dump(ingredient)), 201


@ingredient_blueprint.route('/ingredients/<int:ingredient_id>', methods=['PUT'])
def update_ingredient(ingredient_id):
    ingredient = db_Ingredient.query.get(ingredient_id)
    if not ingredient:
        return jsonify({'error': 'Ingredient not found'}), 404
    ingredient_schema.load(request.json, instance=ingredient, session=db.session)
    db.session.commit()
    return jsonify(ingredient_schema.dump(ingredient)), 200


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
    return jsonify(possible_tags_schema.dump(tags))
