from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class VehicleCreate(BaseModel):
    registration_number: str = Field(..., min_length=1, max_length=20)
    vehicle_type: str | None = None
    brand: str | None = None
    model: str | None = None
    manufacture_year: int | None = None
    fuel_type: str | None = None
    capacity: int | None = None
    assigned_driver: UUID | None = None
    status: str = "Available"


class VehicleUpdate(BaseModel):
    registration_number: str | None = None
    vehicle_type: str | None = None
    brand: str | None = None
    model: str | None = None
    manufacture_year: int | None = None
    fuel_type: str | None = None
    capacity: int | None = None
    assigned_driver: UUID | None = None
    status: str | None = None


class VehicleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    vehicle_id: UUID
    registration_number: str
    vehicle_type: str | None = None
    brand: str | None = None
    model: str | None = None
    manufacture_year: int | None = None
    fuel_type: str | None = None
    capacity: int | None = None
    assigned_driver: UUID | None = None
    status: str


class VehicleStats(BaseModel):
    total: int
    available: int
    in_transit: int
    maintenance: int
    out_of_service: int
