"""Previous migration renamed `tag` columns to `name`.

With the initial schema already using `name`, this revision becomes a no-op.
"""

from alembic import op  # noqa: F401
import sqlalchemy as sa  # noqa: F401

# revision identifiers, used by Alembic.
revision = "cc1a9ac14d24"
down_revision = "1e93c782c25f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """No-op since tables already use `name`."""
    pass


def downgrade() -> None:
    """No-op."""
    pass
