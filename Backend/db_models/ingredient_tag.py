# db_models/ingredient_tag.py
from db import db

class IngredientTag(db.Model):
    __tablename__ = 'ingredient_tags'

    ingredient_id = db.Column(db.Integer, db.ForeignKey('ingredients.id'), primary_key=True)
    tag_id = db.Column(db.Integer, db.ForeignKey('possible_ingredient_tags.id'), primary_key=True)

