"""create_stored_food_table

Revision ID: f2c5a3b4d6e7
Revises: c9271ea398b2
Create Date: 2024-11-26 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f2c5a3b4d6e7'
down_revision = 'c9271ea398b2'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'stored_food',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.String(length=255), nullable=False),
        sa.Column('label', sa.String(length=255), nullable=True),
        sa.Column('food_id', sa.Integer(), nullable=True),
        sa.Column('ingredient_id', sa.Integer(), nullable=True),
        sa.Column('prepared_portions', sa.Float(), nullable=False),
        sa.Column('remaining_portions', sa.Float(), nullable=False),
        sa.Column('per_portion_calories', sa.Float(), nullable=False),
        sa.Column('per_portion_protein', sa.Float(), nullable=False),
        sa.Column('per_portion_carbohydrates', sa.Float(), nullable=False),
        sa.Column('per_portion_fat', sa.Float(), nullable=False),
        sa.Column('per_portion_fiber', sa.Float(), nullable=False),
        sa.Column('is_finished', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('prepared_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['food_id'], ['foods.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['ingredient_id'], ['ingredients.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint(
            'prepared_portions >= 0',
            name='stored_food_prepared_portions_non_negative',
        ),
        sa.CheckConstraint(
            'remaining_portions >= 0',
            name='stored_food_remaining_portions_non_negative',
        ),
        sa.CheckConstraint(
            '(food_id IS NOT NULL AND ingredient_id IS NULL) OR '
            '(food_id IS NULL AND ingredient_id IS NOT NULL)',
            name='stored_food_food_or_ingredient_ck',
        ),
    )
    op.create_index('ix_stored_food_user_id', 'stored_food', ['user_id'], unique=False)
    op.create_index(
        'ix_stored_food_user_finished', 'stored_food', ['user_id', 'is_finished'], unique=False
    )


def downgrade():
    op.drop_index('ix_stored_food_user_finished', table_name='stored_food')
    op.drop_index('ix_stored_food_user_id', table_name='stored_food')
    op.drop_table('stored_food')
