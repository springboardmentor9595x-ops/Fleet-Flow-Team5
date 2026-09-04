"""add attendance date and status

Revision ID: h8i9j0k1l2m3
Revises: g7h8i9j0k1l2
Create Date: 2026-08-30 10:20:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'h8i9j0k1l2m3'
down_revision = 'g7h8i9j0k1l2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('attendance', sa.Column('date', sa.Date(), nullable=False, server_default=sa.text('CURRENT_DATE')))
    op.add_column('attendance', sa.Column('status', sa.String(length=20), server_default='Present', nullable=False))
    op.add_column('attendance', sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False))
    op.create_index(op.f('ix_attendance_date'), 'attendance', ['date'], unique=False)
    op.create_unique_constraint('uq_attendance_driver_date', 'attendance', ['driver_id', 'date'])


def downgrade() -> None:
    op.drop_constraint('uq_attendance_driver_date', 'attendance', type_='unique')
    op.drop_index(op.f('ix_attendance_date'), table_name='attendance')
    op.drop_column('attendance', 'created_at')
    op.drop_column('attendance', 'status')
    op.drop_column('attendance', 'date')
