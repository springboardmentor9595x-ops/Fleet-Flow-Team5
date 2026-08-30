import uuid
from sqlalchemy import Column, String, Date, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class Attendance(Base):
    __tablename__ = "attendance"

    attendance_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    driver_id = Column(UUID(as_uuid=True), ForeignKey("drivers.driver_id"))
    date = Column(Date)
    status = Column(String(20))  # Present, Leave, Absent
    remarks = Column(String(255), nullable=True)

