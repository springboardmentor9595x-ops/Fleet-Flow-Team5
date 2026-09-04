from datetime import datetime
from typing import Any
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class ShipmentCreate(BaseModel):
    tracking_number: str | None = None
    source: str = Field(..., min_length=2, max_length=255)
    destination: str = Field(..., min_length=2, max_length=255)
    source_lat: float | None = None
    source_lng: float | None = None
    dest_lat: float | None = None
    dest_lng: float | None = None
    customer_name: str = Field(..., min_length=2, max_length=100)
    customer_phone: str | None = None
    customer_email: str | None = None
    shipment_weight: float | None = None
    vehicle_id: UUID | None = None
    driver_id: UUID | None = None
    expected_delivery_time: datetime | None = None
    notes: str | None = None


class ShipmentUpdate(BaseModel):
    source: str | None = None
    destination: str | None = None
    source_lat: float | None = None
    source_lng: float | None = None
    dest_lat: float | None = None
    dest_lng: float | None = None
    customer_name: str | None = None
    customer_phone: str | None = None
    customer_email: str | None = None
    shipment_weight: float | None = None
    vehicle_id: UUID | None = None
    driver_id: UUID | None = None
    status: str | None = None
    expected_delivery_time: datetime | None = None
    actual_delivery_time: datetime | None = None
    notes: str | None = None


class ShipmentStatusUpdate(BaseModel):
    status: str = Field(..., description="Created, Assigned, In Transit, Delayed, Delivered, Cancelled")
    notes: str | None = None


class ShipmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    shipment_id: UUID
    tracking_number: str
    source: str | None = None
    destination: str | None = None
    source_lat: float | None = None
    source_lng: float | None = None
    dest_lat: float | None = None
    dest_lng: float | None = None
    customer_name: str | None = None
    customer_phone: str | None = None
    customer_email: str | None = None
    shipment_weight: float | None = None
    vehicle_id: UUID | None = None
    driver_id: UUID | None = None
    driver_name: str | None = None
    status: str
    expected_delivery_time: datetime | None = None
    actual_delivery_time: datetime | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime


class ShipmentAlert(BaseModel):
    shipment_id: UUID
    tracking_number: str
    customer_name: str | None = None
    status: str
    expected_delivery_time: datetime | None = None
    is_delayed: bool
    delay_hours: float
    message: str


class DriverSummary(BaseModel):
    driver_id: UUID
    full_name: str | None = None
    email: str | None = None
    phone: str | None = None
    license_number: str | None = None
    status: str | None = None


class VehicleSummary(BaseModel):
    vehicle_id: UUID
    registration_number: str
    brand: str | None = None
    model: str | None = None
    vehicle_type: str | None = None
    status: str | None = None


class TripSummary(BaseModel):
    trip_id: UUID
    shipment_id: UUID | None = None
    vehicle_id: UUID
    driver_id: UUID | None = None
    start_location: str | None = None
    destination: str | None = None
    route_type: str | None = "fastest"
    planned_distance_km: float | None = None
    planned_duration_min: float | None = None
    route_geometry: Any = None
    status: str | None = None


class GPSTrackingSummary(BaseModel):
    latitude: float
    longitude: float
    speed: float | None = 0.0
    heading: float | None = 0.0
    recorded_time: datetime


class ShipmentTrackingDetail(BaseModel):
    shipment: ShipmentRead
    driver: DriverSummary | None = None
    vehicle: VehicleSummary | None = None
    trip: TripSummary | None = None
    tracking: GPSTrackingSummary | None = None
    remaining_distance_km: float | None = None
    remaining_duration_min: float | None = None
    remaining_eta_text: str | None = None
    tracking_state: str
    message: str

