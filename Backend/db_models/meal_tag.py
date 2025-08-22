# db_models/meal_tag.py
from sqlalchemy import Column, ForeignKey, Integer, Table

from ..db import Base


meal_tags = Table(
    "meal_tags",
    Base.metadata,
    Column("meal_id", Integer, ForeignKey("meals.id"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("possible_meal_tags.id"), primary_key=True),
)
