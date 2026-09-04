from datetime import date, datetime
from typing import Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class AttendanceCreate(BaseModel):
    driver_id: UUID
    date: date
    status: Literal["Present", "Leave", "Absent"] = "Present"


class AttendanceUpdate(BaseModel):
    status: Literal["Present", "Leave", "Absent"]


class AttendanceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    attendance_id: UUID
    driver_id: UUID
    date: date
    status: str
    check_in_time: datetime | None = None
    check_out_time: datetime | None = None
    remarks: str | None = None
    created_at: datetime | None = None

    check_in: str | None = None
    check_out: str | None = None
    working_hours: str | None = None

    # Joined driver/user info
    driver_name: str | None = None
    driver_email: str | None = None
    license_number: str | None = None


class AttendanceSummary(BaseModel):
    driver_id: UUID
    driver_name: str | None = None
    month: int
    year: int
    total_days: int = 0
    present_days: int = 0
    leave_days: int = 0
    absent_days: int = 0
    attendance_rate_pct: float | None = None
