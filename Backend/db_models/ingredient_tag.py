# db_models/ingredient_tag.py
from sqlalchemy import Column, ForeignKey, Integer, Table

from db import Base


ingredient_tags = Table(
    "ingredient_tags",
    Base.metadata,
    Column("ingredient_id", Integer, ForeignKey("ingredients.id"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("possible_ingredient_tags.id"), primary_key=True),
)

