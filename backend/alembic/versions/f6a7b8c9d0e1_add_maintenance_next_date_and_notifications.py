"""add maintenance next_service_date and expanded notifications

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-08-20 20:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'f6a7b8c9d0e1'
down_revision = 'e5f6a7b8c9d0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add next_service_date to vehicle_maintenance
    op.add_column('vehicle_maintenance', sa.Column('next_service_date', sa.DateTime(timezone=True), nullable=True))

    # 2. Update notifications table columns
    op.alter_column('notifications', 'user_id', existing_type=postgresql.UUID(as_uuid=True), nullable=True)
    op.add_column('notifications', sa.Column('maintenance_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('vehicle_maintenance.maintenance_id', ondelete='CASCADE'), nullable=True))
    op.add_column('notifications', sa.Column('notification_type', sa.String(length=50), nullable=False, server_default='maintenance_alert'))
    op.add_column('notifications', sa.Column('title', sa.String(length=150), nullable=False, server_default='Notification'))
    op.add_column('notifications', sa.Column('message', sa.Text(), nullable=False, server_default=''))
    op.add_column('notifications', sa.Column('is_read', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column('notifications', sa.Column('sent_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False))
    op.add_column('notifications', sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False))


def downgrade() -> None:
    op.drop_column('notifications', 'created_at')
    op.drop_column('notifications', 'sent_at')
    op.drop_column('notifications', 'is_read')
    op.drop_column('notifications', 'message')
    op.drop_column('notifications', 'title')
    op.drop_column('notifications', 'notification_type')
    op.drop_constraint('notifications_maintenance_id_fkey', 'notifications', type_='foreignkey')
    op.drop_column('notifications', 'maintenance_id')
    op.alter_column('notifications', 'user_id', existing_type=postgresql.UUID(as_uuid=True), nullable=False)
    op.drop_column('vehicle_maintenance', 'next_service_date')
