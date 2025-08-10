# db_models/ingredient_tag.py
from db import db


ingredient_tags = db.Table(
    'ingredient_tags',
    db.Column('ingredient_id', db.Integer, db.ForeignKey('ingredients.id'), primary_key=True),
    db.Column('tag_id', db.Integer, db.ForeignKey('possible_ingredient_tags.id'), primary_key=True),
)

