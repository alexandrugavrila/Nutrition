"""unify models using SQLModel"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "1e93c782c25f"
down_revision = "00a7d3b5f188"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """No schema changes required; models unified under SQLModel."""
    pass


def downgrade() -> None:
    pass
