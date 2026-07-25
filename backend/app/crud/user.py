"""
Data-access helpers for the User model.

Kept thin and framework-agnostic (plain functions over a Session) so they
can be reused from routers, background tasks, or tests without pulling
in FastAPI-specific dependencies.
"""

from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.user import RoleEnum, User


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email).first()


def create_user(
    db: Session,
    email: str,
    password: str,
    full_name: str,
    phone: str | None,
    role: RoleEnum,
) -> User:
    """Hash the password and persist a new user.

    `role` is stored as its plain string value since users.role is a
    VARCHAR(30) column, not a native Postgres ENUM (see app/models/user.py
    for why).
    """
    user = User(
        email=email,
        password=hash_password(password),
        full_name=full_name,
        phone=phone,
        role=role.value,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
