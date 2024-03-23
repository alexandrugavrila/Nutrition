# db_models/meal_ingredients.py
from db import db

class IngredientUnit(db.Model):
    __tablename__ = 'ingredient_units'
    
    id = db.Column(db.Integer, primary_key=True)
    ingredient_id = db.Column(db.Integer, db.ForeignKey('ingredients.id'), nullable=False)
    name = db.Column(db.String(50), nullable=False)
    grams = db.Column(db.Numeric(10, 4), nullable=False)