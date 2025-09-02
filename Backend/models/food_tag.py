from sqlmodel import SQLModel, Field


class FoodTagLink(SQLModel, table=True):
    """Association table linking foods and tags."""

    __tablename__ = "food_tags"

    food_id: int = Field(foreign_key="foods.id", primary_key=True)
    tag_id: int = Field(foreign_key="possible_food_tags.id", primary_key=True)
