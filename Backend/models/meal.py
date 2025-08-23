from typing import List, Optional, TYPE_CHECKING

from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, String

from .meal_ingredient import MealIngredient
from .possible_meal_tag import PossibleMealTag
from .meal_tag import MealTagLink

if TYPE_CHECKING:  # pragma: no cover - only for type checking
    from .schemas import MealCreate


class Meal(SQLModel, table=True):
    """Meal with associated ingredients and tags."""

    __tablename__ = "meals"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(sa_column=Column(String(100), unique=True, nullable=False))

    ingredients: List[MealIngredient] = Relationship(
        back_populates="meal",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    tags: List[PossibleMealTag] = Relationship(
        back_populates="meals", link_model=MealTagLink
    )

    @classmethod
    def from_create(cls, data: "MealCreate") -> "Meal":
        """Create a :class:`Meal` ORM object from a ``MealCreate`` schema."""

        meal = cls(name=data.name)

        meal.ingredients = [
            MealIngredient.model_validate(mi.model_dump()) for mi in data.ingredients
        ]

        # Tags are populated in the routes after resolving the provided IDs
        # against the database. ``Meal.from_create`` therefore leaves the
        # ``tags`` relationship empty here.

        return meal
