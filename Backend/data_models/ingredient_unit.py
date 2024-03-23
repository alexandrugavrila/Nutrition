# data_models/ingredient_unit.py
class IngredientUnit():
    def __init__(self, id, ingredient_id, name, grams):
        self.id = id
        self.ingredient_id = ingredient_id
        self.name = name
        self.grams = grams

    def serialize(self):
        return {
            'id': self.id,
            'ingredient_id': self.ingredient_id,
            'name': self.name,
            'grams': self.grams
        }