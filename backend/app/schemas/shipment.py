from datetime import datetime
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
