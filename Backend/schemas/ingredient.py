from marshmallow_sqlalchemy import SQLAlchemyAutoSchema, auto_field, fields

from db import db
from db_models.ingredient import Ingredient
from db_models.nutrition import Nutrition
from db_models.ingredient_unit import IngredientUnit
from db_models.possible_ingredient_tag import PossibleIngredientTag


class NutritionSchema(SQLAlchemyAutoSchema):
    id = auto_field(dump_only=True)

    class Meta:
        model = Nutrition
        load_instance = True
        include_fk = True
        sqla_session = db.session


class IngredientUnitSchema(SQLAlchemyAutoSchema):
    id = auto_field(dump_only=True)

    class Meta:
        model = IngredientUnit
        load_instance = True
        include_fk = True
        sqla_session = db.session


class PossibleIngredientTagSchema(SQLAlchemyAutoSchema):
    id = auto_field(required=True)
    name = auto_field("tag", dump_only=True)

    class Meta:
        model = PossibleIngredientTag
        load_instance = True
        sqla_session = db.session


class IngredientSchema(SQLAlchemyAutoSchema):
    id = auto_field(dump_only=True)
    nutrition = fields.Nested(NutritionSchema)
    units = fields.List(fields.Nested(IngredientUnitSchema))
    tags = fields.List(fields.Nested(PossibleIngredientTagSchema))

    class Meta:
        model = Ingredient
        load_instance = True
        include_relationships = True
        sqla_session = db.session
