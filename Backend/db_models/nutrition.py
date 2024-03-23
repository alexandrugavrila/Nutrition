# models/nutrition.py
from db import db

class Nutrition(db.Model):
    __tablename__ = 'nutrition'
    id = db.Column(db.Integer, primary_key=True)
    ingredient_id = db.Column(db.Integer, db.ForeignKey('ingredients.id'), nullable=False)
    calories = db.Column(db.Numeric(10, 4), nullable=False)
    fat = db.Column(db.Numeric(10, 4), nullable=False)
    carbohydrates = db.Column(db.Numeric(10, 4), nullable=False)
    protein = db.Column(db.Numeric(10, 4), nullable=False)
    fiber = db.Column(db.Numeric(10, 4), nullable=False)

