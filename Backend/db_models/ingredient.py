# models/ingredient.py
from db import db
from .ingredient_tag import ingredient_tags

class Ingredient(db.Model):
    __tablename__ = 'ingredients'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    nutrition = db.relationship(
        'Nutrition', backref='ingredient', uselist=False, cascade='all, delete-orphan'
    )
    units = db.relationship(
        'IngredientUnit', backref='ingredient', cascade='all, delete-orphan'
    )
    tags = db.relationship(
        'PossibleIngredientTag', secondary=ingredient_tags, backref='ingredients'
    )

