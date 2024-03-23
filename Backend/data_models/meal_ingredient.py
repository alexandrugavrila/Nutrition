# data_models/meal_ingredient.py
class MealIngredient():
    def __init__(self, ingredient_id: int, meal_id: int, unit_id: int, amount: float):
        self.ingredient_id = ingredient_id
        self.meal_id = meal_id
        self.unit_id = unit_id
        self.amount = amount

    def serialize(self):
        return {
            'ingredient_id': self.ingredient_id,
            'meal_id': self.meal_id,
            'amount': self.amount,
            'unit_id': self.unit_id
        }
