from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class FuelRecordBase(BaseModel):
    vehicle_id: UUID
    liters: float = Field(..., gt=0.0)
    cost: float = Field(..., ge=0.0)
    odometer_km: float = Field(..., ge=0.0)
    fuel_type: str = Field("Diesel", max_length=50)
    fuel_station: str | None = None
    receipt_number: str | None = None
    fuel_date: datetime = Field(default_factory=datetime.utcnow)


class FuelRecordCreate(FuelRecordBase):
    driver_id: UUID | None = None


class FuelRecordRead(FuelRecordBase):
    model_config = ConfigDict(from_attributes=True)

    fuel_id: UUID
    driver_id: UUID | None = None
    created_at: datetime
    vehicle_registration: str | None = None
    driver_name: str | None = None


class FuelTrendItem(BaseModel):
    month: str
    total_liters: float
    total_cost: float
    record_count: int


class FuelStats(BaseModel):
    total_fuel_records: int
    total_liters_consumed: float
    total_fuel_cost: float
    average_cost_per_liter: float
    monthly_trends: list[FuelTrendItem]
