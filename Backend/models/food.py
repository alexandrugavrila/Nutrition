from typing import List, Optional, TYPE_CHECKING

from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, String

from .food_ingredient import FoodIngredient
from .possible_food_tag import PossibleFoodTag
from .food_tag import FoodTagLink

if TYPE_CHECKING:  # pragma: no cover - only for type checking
    from .schemas import FoodCreate


class Food(SQLModel, table=True):
    """Food with associated ingredients and tags."""

    __tablename__ = "foods"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(sa_column=Column(String(100), unique=True, nullable=False))

    ingredients: List[FoodIngredient] = Relationship(
        back_populates="food",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    tags: List[PossibleFoodTag] = Relationship(
        back_populates="foods", link_model=FoodTagLink
    )

    @classmethod
    def from_create(cls, data: "FoodCreate") -> "Food":
        """Create a :class:`Food` ORM object from a ``FoodCreate`` schema."""

        food = cls(name=data.name)

        food.ingredients = [
            FoodIngredient.model_validate(mi.model_dump()) for mi in data.ingredients
        ]

        # Tags are populated in the routes after resolving the provided IDs
        # against the database. ``Food.from_create`` therefore leaves the
        # ``tags`` relationship empty here.

        return food
