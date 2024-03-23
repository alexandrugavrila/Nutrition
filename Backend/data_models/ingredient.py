from typing import List

from data_models.nutrition import Nutrition
from data_models.ingredient_unit import IngredientUnit
from data_models.ingredient_tag import IngredientTag

class Ingredient():
    def __init__(self, id, name, nutrition: Nutrition, units: List[IngredientUnit], tags: List[IngredientTag] = []):
        self.id = id
        self.name = name
        self.nutrition = nutrition
        self.units = units
        self.tags = tags

    def serialize(self):
        return {
            'id': self.id,
            'name': self.name,
            'nutrition': self.nutrition.serialize(),
            'units': [unit.serialize() for unit in self.units], # 'units' is a list of 'IngredientUnit' objects, so we call 'serialize' on each one to get a list of dictionaries, which we then return as the value for 'units
            'tags': [tag.serialize() for tag in self.tags] # 'tags' is a list of 'IngredientTag' objects, so we call 'serialize' on each one to get a list of dictionaries, which we then return as the value for 'tags
        }