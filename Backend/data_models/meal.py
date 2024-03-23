# data_models/meal.py

from typing import List

from data_models.nutrition import Nutrition
from data_models.meal_ingredient import MealIngredient
from data_models.meal_tag import MealTag

class Meal():
    def __init__(self, id: int, name: str, tags: List[MealTag], ingredients: List[MealIngredient]):
        self.id = id
        self.name = name
        self.tags = tags
        self.ingredients = ingredients

    def serialize(self):
        return {
            'id': self.id,
            'name': self.name,
            'tags': [tag.serialize() for tag in self.tags],
            'ingredients': [ingredient.serialize() for ingredient in self.ingredients]
       }