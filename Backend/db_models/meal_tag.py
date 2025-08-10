# db_models/meal_tag.py
from db import db


meal_tags = db.Table(
    'meal_tags',
    db.Column('meal_id', db.Integer, db.ForeignKey('meals.id'), primary_key=True),
    db.Column('tag_id', db.Integer, db.ForeignKey('possible_meal_tags.id'), primary_key=True),
)