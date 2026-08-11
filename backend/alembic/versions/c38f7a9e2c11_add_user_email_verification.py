"""add user email verification

Revision ID: c38f7a9e2c11
Revises: b1159da78ded
"""
from alembic import op
import sqlalchemy as sa

revision = "c38f7a9e2c11"
down_revision = "b1159da78ded"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("is_verified", sa.Boolean(), server_default=sa.false(), nullable=False))


def downgrade() -> None:
    op.drop_column("users", "is_verified")