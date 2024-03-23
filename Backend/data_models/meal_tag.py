# data_models/meal_tag.py
class MealTag():
    def __init__(self, id, name):
        self.name = name
        self.id = id

    def serialize(self):
        return {
            'id': self.id,
            'name': self.name
        }