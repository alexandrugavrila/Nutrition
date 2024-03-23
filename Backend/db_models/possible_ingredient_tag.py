# models/possible_ingredient_tags.py
from db import db

class PossibleIngredientTag(db.Model):
    __tablename__ = 'possible_ingredient_tags'

    id = db.Column(db.Integer, primary_key=True)
    tag = db.Column(db.String(50), nullable=False)