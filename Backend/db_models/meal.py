# models/meal.py
from db import db
from .meal_tag import meal_tags

class Meal(db.Model):
    __tablename__ = 'meals'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    ingredients = db.relationship(
        'MealIngredient', backref='meal', cascade='all, delete-orphan'
    )
    tags = db.relationship(
        'PossibleMealTag', secondary=meal_tags, backref='meals'
    )
