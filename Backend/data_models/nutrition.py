class Nutrition():
    def __init__(self, calories, fat, carbohydrates, protein, fiber):
        self.calories = calories
        self.fat = fat
        self.carbohydrates = carbohydrates
        self.protein = protein
        self.fiber = fiber


    def serialize(self):
        return {
            'calories': self.calories,
            'fat': self.fat,
            'carbohydrates': self.carbohydrates,
            'protein': self.protein,
            'fiber': self.fiber
        }