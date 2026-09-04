from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class DriverCreate(BaseModel):
    user_id: UUID
    license_number: str = Field(..., max_length=50)
    experience_years: int | None = Field(default=0, ge=0)
    address: str | None = None
    status: str = Field(default="Active", max_length=20)


class DriverUpdate(BaseModel):
    license_number: str | None = None
    experience_years: int | None = None
    address: str | None = None
    status: str | None = None


class DriverRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    driver_id: UUID
    user_id: UUID
    license_number: str | None = None
    experience_years: int | None = None
    address: str | None = None
    status: str
    created_at: datetime | None = None

    # Joined user details
    full_name: str | None = None
    email: str | None = None
    phone: str | None = None

    # Joined assigned vehicle details
    assigned_vehicle_id: UUID | None = None
    assigned_vehicle_registration: str | None = None
    assigned_vehicle_model: str | None = None
