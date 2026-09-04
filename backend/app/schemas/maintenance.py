from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class MaintenanceBase(BaseModel):
    vehicle_id: UUID
    service_type: str = Field(..., min_length=2, max_length=100)
    description: str | None = None
    cost: float = Field(0.0, ge=0.0)
    service_date: datetime = Field(default_factory=datetime.utcnow)
    next_service_date: datetime | None = None
    status: str = Field("Scheduled", max_length=50)
    service_center: str | None = None
    performed_by: str | None = None


class MaintenanceCreate(MaintenanceBase):
    pass


class MaintenanceUpdate(BaseModel):
    service_type: str | None = None
    description: str | None = None
    cost: float | None = None
    service_date: datetime | None = None
    next_service_date: datetime | None = None
    status: str | None = None
    service_center: str | None = None
    performed_by: str | None = None


class MaintenanceStatusUpdate(BaseModel):
    status: str = Field(..., max_length=50)


class MaintenanceRead(MaintenanceBase):
    model_config = ConfigDict(from_attributes=True)

    maintenance_id: UUID
    created_at: datetime
    updated_at: datetime
    vehicle_registration: str | None = None
    vehicle_brand: str | None = None
    vehicle_model: str | None = None


class MaintenanceStats(BaseModel):
    total_records: int
    scheduled: int
    in_progress: int
    completed: int
    cancelled: int
    total_cost: float
