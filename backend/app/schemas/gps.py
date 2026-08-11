from uuid import UUID
from typing import Optional
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict


class GPSPingIn(BaseModel):
    latitude: Decimal
    longitude: Decimal
    speed: Optional[Decimal] = None
    heading: Optional[Decimal] = None
    altitude: Optional[Decimal] = None
    accuracy: Optional[Decimal] = None


class GPSPingOut(BaseModel):
    tracking_id: UUID
    vehicle_id: UUID
    latitude: Decimal
    longitude: Decimal
    speed: Optional[Decimal] = None
    heading: Optional[Decimal] = None
    altitude: Optional[Decimal] = None
    accuracy: Optional[Decimal] = None
    recorded_time: datetime

    model_config = ConfigDict(from_attributes=True)
