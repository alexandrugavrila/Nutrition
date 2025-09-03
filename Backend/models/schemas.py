from typing import List, Optional

from pydantic import ConfigDict
from sqlmodel import Field, SQLModel

from .ingredient_unit import IngredientUnit
from .meal_ingredient import MealIngredient
from .nutrition import Nutrition


class NutritionCreate(SQLModel):
    """Schema for creating nutrition data."""

    calories: float
    fat: float
    carbohydrates: float
    protein: float
    fiber: float


class IngredientUnitCreate(SQLModel):
    """Schema for creating ingredient unit data."""

    name: str
    grams: float


class MealIngredientCreate(SQLModel):
    """Schema for creating meal ingredient linkage."""

    ingredient_id: int
    unit_id: Optional[int] = None
    unit_quantity: Optional[float] = None


class TagRef(SQLModel):
    """Reference to an existing tag by ID."""

    id: int


class PossibleIngredientTagRead(SQLModel):
    """Schema for reading a possible ingredient tag."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    group: str


class PossibleMealTagRead(SQLModel):
    """Schema for reading a possible meal tag."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    group: str


class IngredientCreate(SQLModel):
    """Schema for creating an ingredient."""

    name: str
    nutrition: Optional[NutritionCreate] = None
    units: List[IngredientUnitCreate] = Field(default_factory=list)
    tags: List[TagRef] = Field(default_factory=list)


class IngredientUpdate(IngredientCreate):
    """Schema for updating an ingredient."""

    pass


class IngredientRead(SQLModel):
    """Schema for reading ingredient data."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    nutrition: Optional[Nutrition] = None
    units: List[IngredientUnit] = Field(default_factory=list)
    tags: List[PossibleIngredientTagRead] = Field(default_factory=list)


class MealCreate(SQLModel):
    """Schema for creating a meal."""

    name: str
    ingredients: List[MealIngredientCreate] = Field(default_factory=list)
    tags: List[TagRef] = Field(default_factory=list)


class MealUpdate(MealCreate):
    """Schema for updating a meal."""

    pass


class MealRead(SQLModel):
    """Schema for reading meal data."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    ingredients: List[MealIngredient] = Field(default_factory=list)
    tags: List[PossibleMealTagRead] = Field(default_factory=list)


__all__ = [
    "NutritionCreate",
    "IngredientUnitCreate",
    "MealIngredientCreate",
    "TagRef",
    "IngredientCreate",
    "IngredientUpdate",
    "IngredientRead",
    "MealCreate",
    "MealUpdate",
    "MealRead",
    "PossibleIngredientTagRead",
    "PossibleMealTagRead",
]
