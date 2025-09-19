"""Add plans table for persisted planning data."""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "1a2b3c4d5e66"
down_revision = "9e3e2a7a1abc"
branch_labels = None
depends_on = None


def upgrade():
    """Create plans table."""
    op.create_table(
        "plans",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(length=255), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_plans_label", "plans", ["label"], unique=False)


def downgrade():
    """Drop plans table."""
    op.drop_index("ix_plans_label", table_name="plans")
    op.drop_table("plans")
