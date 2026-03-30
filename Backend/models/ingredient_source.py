from typing import Optional, TYPE_CHECKING

from sqlalchemy import Column, String, UniqueConstraint
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:  # pragma: no cover - only for type checking
    from .ingredient import Ingredient


class IngredientSource(SQLModel, table=True):
    """External source mapping for an ingredient."""

    __tablename__ = "ingredient_sources"
    __table_args__ = (
        UniqueConstraint(
            "source",
            "source_id",
            name="uq_ingredient_sources_source_source_id",
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    ingredient_id: int = Field(
        foreign_key="ingredients.id",
        nullable=False,
    )
    source: str = Field(sa_column=Column(String(50), nullable=False))
    source_id: str = Field(sa_column=Column(String(100), nullable=False))

    ingredient: Optional["Ingredient"] = Relationship(back_populates="sources")
