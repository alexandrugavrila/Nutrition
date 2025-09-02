"""Merge heads: constraints and rename

This merge unifies two independent branches:
- 2ea617f76053: restore ingredient_id non-null
- 3a2af5cf8e9b: rename meal tables to food

No schema changes are applied in this merge; it only reconciles history
so that future upgrades can target a single head.
"""

from alembic import op  # noqa: F401
import sqlalchemy as sa  # noqa: F401

# revision identifiers, used by Alembic.
revision = "4f3a5b7c9d01"
down_revision = ("2ea617f76053", "3a2af5cf8e9b")
branch_labels = None
depends_on = None


def upgrade() -> None:
    # No-op: merge only.
    pass


def downgrade() -> None:
    # No-op: splitting branches is not supported.
    pass

