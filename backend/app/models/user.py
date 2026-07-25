"""
Users table — the single fully-implemented model for Milestone 1.

Every other user of the system (Driver, FleetManager, Dispatcher, Admin)
is represented as a row here, distinguished by `role`. The Driver-specific
profile (license number, experience, etc.) lives in a separate `drivers`
table that has a one-to-one FK back to this table.

Note on `role`: this is stored as a plain VARCHAR(30) rather than a native
Postgres ENUM type. SQLAlchemy's Enum() column creates a real `CREATE TYPE`
in Postgres, and Alembic autogenerate handles changes to that type poorly
(re-running `alembic revision --autogenerate` or `alembic upgrade head`
after any edit commonly raises `duplicate type "roleenum" already exists`,
and enum value changes aren't autodetected as ALTER statements). A VARCHAR
column keeps migrations to simple, predictable ALTER COLUMN operations.
`RoleEnum` is kept as a Python-side validation helper — it constrains
values in the Pydantic schema layer (Step 7) without touching the DB type.
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, String
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class RoleEnum(str, enum.Enum):
    """Valid values for users.role, enforced at the application layer."""

    Admin = "Admin"
    FleetManager = "FleetManager"
    Driver = "Driver"
    Dispatcher = "Dispatcher"


class User(Base):
    __tablename__ = "users"

    user_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    full_name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, nullable=False, index=True)
    password = Column(String(255), nullable=False)
    phone = Column(String(15))
    role = Column(String(30), nullable=False, default=RoleEnum.Driver.value)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging aid only
        return f"<User user_id={self.user_id} email={self.email!r} role={self.role}>"
