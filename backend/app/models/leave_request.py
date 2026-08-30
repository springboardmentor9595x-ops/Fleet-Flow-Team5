import uuid
from datetime import datetime
from sqlalchemy import Column, String, Date, DateTime, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class LeaveRequest(Base):
    __tablename__ = "leave_requests"

    leave_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    driver_id = Column(UUID(as_uuid=True), ForeignKey("drivers.driver_id"), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    leave_type = Column(String(50), default="Casual")  # Casual, Sick, Medical, Emergency, Vacation
    reason = Column(Text, nullable=True)
    status = Column(String(20), default="Pending")  # Pending, Approved, Rejected, Cancelled
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    manager_remarks = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
