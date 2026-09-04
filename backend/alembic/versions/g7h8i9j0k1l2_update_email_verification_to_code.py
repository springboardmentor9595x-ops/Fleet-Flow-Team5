"""update email verification to 6-digit code

Revision ID: g7h8i9j0k1l2
Revises: f6a7b8c9d0e1
Create Date: 2026-08-23 10:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'g7h8i9j0k1l2'
down_revision = 'f6a7b8c9d0e1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # email_verification_tokens table already contains token_hash (String 64) and expires_at.
    # No destructive structural changes required, but we document the shift to 6-digit code storage.
    pass


def downgrade() -> None:
    pass
