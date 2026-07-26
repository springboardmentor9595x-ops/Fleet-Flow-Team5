import uuid
from sqlalchemy import Column, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class Attendance(Base):
    __tablename__ = "attendance"

    attendance_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        unique=True,
        nullable=False,
    )
    driver_id = Column(
        UUID(as_uuid=True),
        ForeignKey("drivers.driver_id", ondelete="CASCADE"),
        nullable=False,
    )
