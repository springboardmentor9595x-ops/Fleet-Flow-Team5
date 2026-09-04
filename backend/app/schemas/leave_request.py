from datetime import date, datetime
from typing import Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, field_validator


LEAVE_TYPES = ("Casual Leave", "Sick Leave", "Vacation", "Emergency Leave", "Other")


class LeaveRequestCreate(BaseModel):
    leave_type: Literal["Casual Leave", "Sick Leave", "Vacation", "Emergency Leave", "Other"] = Field(...)
    start_date: date = Field(...)
    end_date: date = Field(...)
    reason: str = Field(..., min_length=3, max_length=1000)

    @field_validator("reason")
    @classmethod
    def validate_reason_not_empty(cls, value: str) -> str:
        s = value.strip()
        if not s:
            raise ValueError("Reason cannot be empty.")
        return s


class LeaveRequestReview(BaseModel):
    status: Literal["Approved", "Rejected"] = Field(...)
    rejection_reason: str | None = Field(None, max_length=1000)


class LeaveRequestRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    leave_id: UUID
    driver_id: UUID
    leave_type: str
    start_date: date
    end_date: date
    days_count: int
    reason: str
    status: str
    rejection_reason: str | None = None
    reviewed_by: UUID | None = None
    reviewed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    driver_name: str | None = None
    driver_email: str | None = None
    reviewer_name: str | None = None
