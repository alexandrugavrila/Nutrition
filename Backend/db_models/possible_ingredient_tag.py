# models/possible_ingredient_tags.py
from sqlalchemy import Column, Integer, String

from db import Base


class PossibleIngredientTag(Base):
    __tablename__ = "possible_ingredient_tags"

    id = Column(Integer, primary_key=True)
    tag = Column(String(50), nullable=False, unique=True)

