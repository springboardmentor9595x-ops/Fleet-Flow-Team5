import uuid
from sqlalchemy import Boolean, Column, String, DateTime, func
from sqlalchemy.orm import synonym
from sqlalchemy.dialects.postgresql import UUID, ENUM as PGEnum
from app.database import Base

user_roles = PGEnum(
    "Admin",
    "FleetManager",
    "Driver",
    "Dispatcher",
    name="user_roles",
    create_type=True,
)


class User(Base):
    __tablename__ = "users"

    user_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        unique=True,
        nullable=False,
    )
    full_name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    password = Column(String(255), nullable=False)
    phone = Column(String(15), nullable=True)
    role = Column(
        user_roles,
        nullable=False,
        server_default="Driver",
    )
    is_verified = Column(Boolean, nullable=False, server_default="false")
    email_verified = synonym("is_verified")
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
