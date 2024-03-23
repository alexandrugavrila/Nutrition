# models/meal_ingredients.py
from db import db

class PossibleMealTag(db.Model):
    __tablename__ = 'possible_meal_tags'
    
    id = db.Column(db.Integer, primary_key=True)
    tag = db.Column(db.String(50), nullable=False)

