# models/ingredient.py
from db import db

class Ingredient(db.Model):
    __tablename__ = 'ingredients'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    tags = db.relationship('IngredientTag', backref='ingredient', lazy=True)
