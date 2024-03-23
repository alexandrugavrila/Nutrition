# models/meal_ingredients.py
from db import db

class MealIngredient(db.Model):
    __tablename__ = 'meal_ingredients'

    ingredient_id = db.Column(db.Integer, db.ForeignKey('ingredients.id'), primary_key=True)
    meal_id = db.Column(db.Integer, db.ForeignKey('meals.id'), primary_key=True)
    unit_id = db.Column(db.Integer, db.ForeignKey('ingredient_units.id'))
    unit_quantity = db.Column(db.Numeric(10, 4))
    
    unit = db.relationship('IngredientUnit')
    __table_args__ = (
        db.ForeignKeyConstraint(['unit_id'], ['ingredient_units.id']),
    )
