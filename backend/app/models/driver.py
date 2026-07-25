import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class Driver(Base):
    __tablename__ = "drivers"

    driver_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), unique=True)
    license_number = Column(String(50), unique=True)
    experience_years = Column(Integer)
    address = Column(Text)
    status = Column(String(20), default="Active")
    created_at = Column(DateTime, default=datetime.utcnow)

