from marshmallow_sqlalchemy import SQLAlchemyAutoSchema, auto_field, fields

from db import db
from db_models.meal import Meal
from db_models.meal_ingredient import MealIngredient
from db_models.possible_meal_tag import PossibleMealTag


class MealIngredientSchema(SQLAlchemyAutoSchema):
    amount = auto_field("unit_quantity", data_key="amount")

    class Meta:
        model = MealIngredient
        load_instance = True
        include_fk = True
        exclude = ("unit_quantity",)
        sqla_session = db.session


class PossibleMealTagSchema(SQLAlchemyAutoSchema):
    id = auto_field(required=True)
    name = auto_field("tag", dump_only=True)

    class Meta:
        model = PossibleMealTag
        load_instance = True
        sqla_session = db.session


class MealSchema(SQLAlchemyAutoSchema):
    id = auto_field(dump_only=True)
    ingredients = fields.List(fields.Nested(MealIngredientSchema))
    tags = fields.List(fields.Nested(PossibleMealTagSchema))

    class Meta:
        model = Meal
        load_instance = True
        include_relationships = True
        sqla_session = db.session
