from uuid import UUID
from typing import Optional, List
from datetime import datetime
from decimal import Decimal
import secrets
from pydantic import BaseModel, ConfigDict, field_validator
from app.models.shipment import ShipmentStatusEnum


class ShipmentCreate(BaseModel):
    tracking_number: Optional[str] = None
    source: str
    destination: str
    customer_name: str
    customer_phone: Optional[str] = None
    shipment_weight: Optional[Decimal] = None
    vehicle_id: Optional[UUID] = None
    driver_id: Optional[UUID] = None
    notes: Optional[str] = None
    expected_delivery: Optional[datetime] = None
    destination_lat: Optional[Decimal] = None
    destination_lon: Optional[Decimal] = None
    source_lat: Optional[Decimal] = None
    source_lon: Optional[Decimal] = None

    @field_validator("tracking_number", mode="before")
    @classmethod
    def auto_generate_tracking(cls, v):
        """Auto-generate FF-YYYY-XXXXXXXX if blank or None."""
        if not v or not str(v).strip():
            year = datetime.utcnow().year
            suffix = secrets.token_hex(4).upper()
            return f"FF-{year}-{suffix}"
        return str(v).strip().upper()


class ShipmentUpdate(BaseModel):
    tracking_number: Optional[str] = None
    source: Optional[str] = None
    destination: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    shipment_weight: Optional[Decimal] = None
    vehicle_id: Optional[UUID] = None
    driver_id: Optional[UUID] = None
    notes: Optional[str] = None
    expected_delivery: Optional[datetime] = None
    destination_lat: Optional[Decimal] = None
    destination_lon: Optional[Decimal] = None
    source_lat: Optional[Decimal] = None
    source_lon: Optional[Decimal] = None


class ShipmentStatusUpdate(BaseModel):
    status: ShipmentStatusEnum
    note: Optional[str] = None


class ShipmentOut(BaseModel):
    shipment_id: UUID
    tracking_number: str
    source: str
    destination: str
    customer_name: str
    customer_phone: Optional[str] = None
    shipment_weight: Optional[Decimal] = None
    vehicle_id: Optional[UUID] = None
    driver_id: Optional[UUID] = None
    status: ShipmentStatusEnum
    notes: Optional[str] = None
    expected_delivery: Optional[datetime] = None
    destination_lat: Optional[Decimal] = None
    destination_lon: Optional[Decimal] = None
    source_lat: Optional[Decimal] = None
    source_lon: Optional[Decimal] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    is_delayed: bool = False

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def from_orm_with_delay(cls, obj):
        """Build with delay flag computed."""
        instance = cls.model_validate(obj)
        if obj.expected_delivery and obj.status not in (
            ShipmentStatusEnum.Delivered,
            ShipmentStatusEnum.Cancelled,
        ):
            instance.is_delayed = datetime.utcnow() > obj.expected_delivery
        return instance


class ShipmentHistoryOut(BaseModel):
    history_id: UUID
    shipment_id: UUID
    status: str
    note: Optional[str] = None
    changed_by_name: Optional[str] = None
    changed_at: datetime

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)



class ShipmentListResponse(BaseModel):
    shipments: List[ShipmentOut]
    total: int
    delayed_count: int


class RouteOptimizationRequest(BaseModel):
    shipment_ids: Optional[List[UUID]] = None
    vehicle_id: Optional[UUID] = None
    origin_lat: Optional[Decimal] = None
    origin_lon: Optional[Decimal] = None
    origin_name: Optional[str] = "Fleet Hub"

