# db_models/meal_tag.py
from db import db

class MealTag(db.Model):
    __tablename__ = 'meal_tags'

    meal_id = db.Column(db.Integer, db.ForeignKey('meals.id'), primary_key=True)
    tag_id = db.Column(db.Integer, db.ForeignKey('possible_meal_tags.id'), primary_key=True)