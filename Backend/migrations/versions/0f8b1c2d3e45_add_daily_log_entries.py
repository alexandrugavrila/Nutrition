"""add daily log entries table

Revision ID: 0f8b1c2d3e45
Revises: f2c5a3b4d6e7
Create Date: 2024-11-26 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0f8b1c2d3e45'
down_revision = 'f2c5a3b4d6e7'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'daily_log_entries',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.String(length=255), nullable=False),
        sa.Column('log_date', sa.Date(), nullable=False),
        sa.Column('stored_food_id', sa.Integer(), nullable=True),
        sa.Column('ingredient_id', sa.Integer(), nullable=True),
        sa.Column('food_id', sa.Integer(), nullable=True),
        sa.Column('portions_consumed', sa.Float(), nullable=False),
        sa.Column('calories', sa.Float(), nullable=False),
        sa.Column('protein', sa.Float(), nullable=False),
        sa.Column('carbohydrates', sa.Float(), nullable=False),
        sa.Column('fat', sa.Float(), nullable=False),
        sa.Column('fiber', sa.Float(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "((stored_food_id IS NOT NULL AND ingredient_id IS NULL AND food_id IS NULL) "
            "OR (stored_food_id IS NULL AND ingredient_id IS NOT NULL AND food_id IS NULL) "
            "OR (stored_food_id IS NULL AND ingredient_id IS NULL AND food_id IS NOT NULL))",
            name='daily_log_entries_source_ck',
        ),
        sa.ForeignKeyConstraint(['food_id'], ['foods.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['ingredient_id'], ['ingredients.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['stored_food_id'], ['stored_food.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_daily_log_entries_user_id', 'daily_log_entries', ['user_id'], unique=False)
    op.create_index('ix_daily_log_entries_log_date', 'daily_log_entries', ['log_date'], unique=False)
    op.create_index(
        'ix_daily_log_entries_user_date', 'daily_log_entries', ['user_id', 'log_date'], unique=False
    )


def downgrade():
    op.drop_index('ix_daily_log_entries_user_date', table_name='daily_log_entries')
    op.drop_index('ix_daily_log_entries_log_date', table_name='daily_log_entries')
    op.drop_index('ix_daily_log_entries_user_id', table_name='daily_log_entries')
    op.drop_table('daily_log_entries')
