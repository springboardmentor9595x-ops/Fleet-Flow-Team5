"""milestone2 schema expansion

Revision ID: d4e1f2a3b4c5
Revises: c38f7a9e2c11
Create Date: 2026-08-10 22:35:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'd4e1f2a3b4c5'
down_revision = 'c38f7a9e2c11'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Vehicles table expansion
    op.add_column('vehicles', sa.Column('registration_number', sa.String(length=20), nullable=True))
    op.add_column('vehicles', sa.Column('vehicle_type', sa.String(length=50), nullable=True))
    op.add_column('vehicles', sa.Column('brand', sa.String(length=50), nullable=True))
    op.add_column('vehicles', sa.Column('model', sa.String(length=50), nullable=True))
    op.add_column('vehicles', sa.Column('manufacture_year', sa.Integer(), nullable=True))
    op.add_column('vehicles', sa.Column('fuel_type', sa.String(length=20), nullable=True))
    op.add_column('vehicles', sa.Column('capacity', sa.Integer(), nullable=True))
    op.add_column('vehicles', sa.Column('status', sa.String(length=20), server_default='Available', nullable=False))
    
    # Fill any null registration numbers and make unique
    op.create_index(op.f('ix_vehicles_registration_number'), 'vehicles', ['registration_number'], unique=True)

    # Drivers table expansion
    op.add_column('drivers', sa.Column('license_number', sa.String(length=50), nullable=True))
    op.add_column('drivers', sa.Column('experience_years', sa.Integer(), nullable=True))
    op.add_column('drivers', sa.Column('address', sa.Text(), nullable=True))
    op.add_column('drivers', sa.Column('status', sa.String(length=20), server_default='Active', nullable=False))
    op.add_column('drivers', sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False))
    op.create_unique_constraint('uq_drivers_license_number', 'drivers', ['license_number'])

    # Shipments table expansion
    op.add_column('shipments', sa.Column('tracking_number', sa.String(length=50), nullable=True))
    op.add_column('shipments', sa.Column('source', sa.String(length=255), nullable=True))
    op.add_column('shipments', sa.Column('destination', sa.String(length=255), nullable=True))
    op.add_column('shipments', sa.Column('source_lat', sa.Float(), nullable=True))
    op.add_column('shipments', sa.Column('source_lng', sa.Float(), nullable=True))
    op.add_column('shipments', sa.Column('dest_lat', sa.Float(), nullable=True))
    op.add_column('shipments', sa.Column('dest_lng', sa.Float(), nullable=True))
    op.add_column('shipments', sa.Column('customer_name', sa.String(length=100), nullable=True))
    op.add_column('shipments', sa.Column('customer_phone', sa.String(length=50), nullable=True))
    op.add_column('shipments', sa.Column('customer_email', sa.String(length=100), nullable=True))
    op.add_column('shipments', sa.Column('shipment_weight', sa.Float(), nullable=True))
    op.add_column('shipments', sa.Column('status', sa.String(length=50), server_default='Created', nullable=False))
    op.add_column('shipments', sa.Column('expected_delivery_time', sa.DateTime(timezone=True), nullable=True))
    op.add_column('shipments', sa.Column('actual_delivery_time', sa.DateTime(timezone=True), nullable=True))
    op.add_column('shipments', sa.Column('notes', sa.Text(), nullable=True))
    op.add_column('shipments', sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False))
    op.add_column('shipments', sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False))
    op.create_index(op.f('ix_shipments_tracking_number'), 'shipments', ['tracking_number'], unique=True)

    # Trips table expansion
    op.add_column('trips', sa.Column('start_location', sa.String(length=255), nullable=True))
    op.add_column('trips', sa.Column('destination', sa.String(length=255), nullable=True))
    op.add_column('trips', sa.Column('start_lat', sa.Float(), nullable=True))
    op.add_column('trips', sa.Column('start_lng', sa.Float(), nullable=True))
    op.add_column('trips', sa.Column('dest_lat', sa.Float(), nullable=True))
    op.add_column('trips', sa.Column('dest_lng', sa.Float(), nullable=True))
    op.add_column('trips', sa.Column('route_type', sa.String(length=50), server_default='fastest', nullable=False))
    op.add_column('trips', sa.Column('route_geometry', sa.JSON(), nullable=True))
    op.add_column('trips', sa.Column('planned_distance_km', sa.Float(), nullable=True))
    op.add_column('trips', sa.Column('planned_duration_min', sa.Float(), nullable=True))
    op.add_column('trips', sa.Column('actual_distance_km', sa.Float(), nullable=True))
    op.add_column('trips', sa.Column('actual_duration_min', sa.Float(), nullable=True))
    op.add_column('trips', sa.Column('start_time', sa.DateTime(timezone=True), nullable=True))
    op.add_column('trips', sa.Column('end_time', sa.DateTime(timezone=True), nullable=True))
    op.add_column('trips', sa.Column('status', sa.String(length=50), server_default='Scheduled', nullable=False))
    op.add_column('trips', sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False))
    op.add_column('trips', sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False))

    # GPS Tracking table expansion
    op.add_column('gps_tracking', sa.Column('latitude', sa.Float(), server_default='0.0', nullable=False))
    op.add_column('gps_tracking', sa.Column('longitude', sa.Float(), server_default='0.0', nullable=False))
    op.add_column('gps_tracking', sa.Column('speed', sa.Float(), server_default='0.0', nullable=True))
    op.add_column('gps_tracking', sa.Column('heading', sa.Float(), server_default='0.0', nullable=True))
    op.add_column('gps_tracking', sa.Column('recorded_time', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False))


def downgrade() -> None:
    # GPS Tracking downgrade
    op.drop_column('gps_tracking', 'recorded_time')
    op.drop_column('gps_tracking', 'heading')
    op.drop_column('gps_tracking', 'speed')
    op.drop_column('gps_tracking', 'longitude')
    op.drop_column('gps_tracking', 'latitude')

    # Trips downgrade
    op.drop_column('trips', 'updated_at')
    op.drop_column('trips', 'created_at')
    op.drop_column('trips', 'status')
    op.drop_column('trips', 'end_time')
    op.drop_column('trips', 'start_time')
    op.drop_column('trips', 'actual_duration_min')
    op.drop_column('trips', 'actual_distance_km')
    op.drop_column('trips', 'planned_duration_min')
    op.drop_column('trips', 'planned_distance_km')
    op.drop_column('trips', 'route_geometry')
    op.drop_column('trips', 'route_type')
    op.drop_column('trips', 'dest_lng')
    op.drop_column('trips', 'dest_lat')
    op.drop_column('trips', 'start_lng')
    op.drop_column('trips', 'start_lat')
    op.drop_column('trips', 'destination')
    op.drop_column('trips', 'start_location')

    # Shipments downgrade
    op.drop_index(op.f('ix_shipments_tracking_number'), table_name='shipments')
    op.drop_column('shipments', 'updated_at')
    op.drop_column('shipments', 'created_at')
    op.drop_column('shipments', 'notes')
    op.drop_column('shipments', 'actual_delivery_time')
    op.drop_column('shipments', 'expected_delivery_time')
    op.drop_column('shipments', 'status')
    op.drop_column('shipments', 'shipment_weight')
    op.drop_column('shipments', 'customer_email')
    op.drop_column('shipments', 'customer_phone')
    op.drop_column('shipments', 'customer_name')
    op.drop_column('shipments', 'dest_lng')
    op.drop_column('shipments', 'dest_lat')
    op.drop_column('shipments', 'source_lng')
    op.drop_column('shipments', 'source_lat')
    op.drop_column('shipments', 'destination')
    op.drop_column('shipments', 'source')
    op.drop_column('shipments', 'tracking_number')

    # Drivers downgrade
    op.drop_constraint('uq_drivers_license_number', 'drivers', type_='unique')
    op.drop_column('drivers', 'created_at')
    op.drop_column('drivers', 'status')
    op.drop_column('drivers', 'address')
    op.drop_column('drivers', 'experience_years')
    op.drop_column('drivers', 'license_number')

    # Vehicles downgrade
    op.drop_index(op.f('ix_vehicles_registration_number'), table_name='vehicles')
    op.drop_column('vehicles', 'status')
    op.drop_column('vehicles', 'capacity')
    op.drop_column('vehicles', 'fuel_type')
    op.drop_column('vehicles', 'manufacture_year')
    op.drop_column('vehicles', 'model')
    op.drop_column('vehicles', 'brand')
    op.drop_column('vehicles', 'vehicle_type')
    op.drop_column('vehicles', 'registration_number')
