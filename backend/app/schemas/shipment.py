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
    estimated_arrival: Optional[str] = None
    estimated_arrival_iso: Optional[str] = None
    remaining_distance_km: Optional[float] = None
    remaining_duration_mins: Optional[float] = None
    eta_status: Optional[str] = None
    traffic_condition: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def from_orm_with_delay(cls, obj, eta_data: Optional[dict] = None):
        """Build with delay flag and dynamic ETA computed."""
        instance = cls.model_validate(obj)
        if obj.expected_delivery and obj.status not in (
            ShipmentStatusEnum.Delivered,
            ShipmentStatusEnum.Cancelled,
        ):
            instance.is_delayed = datetime.utcnow() > obj.expected_delivery
            
        if eta_data:
            instance.estimated_arrival = eta_data.get("eta_formatted")
            instance.estimated_arrival_iso = eta_data.get("eta_timestamp")
            instance.remaining_distance_km = eta_data.get("remaining_distance_km")
            instance.remaining_duration_mins = eta_data.get("remaining_duration_mins")
            instance.eta_status = eta_data.get("delay_status")
            instance.traffic_condition = eta_data.get("traffic_condition")
            if eta_data.get("is_delayed") is not None:
                instance.is_delayed = instance.is_delayed or eta_data["is_delayed"]
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

