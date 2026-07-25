"""
Pydantic schemas for the User resource.

These are the request/response contracts for the /auth endpoints — kept
separate from the SQLAlchemy model (app.models.user.User) so the API
shape can evolve independently of the DB schema.
"""

from uuid import UUID

from pydantic import BaseModel, EmailStr

from app.models.user import RoleEnum


class UserCreate(BaseModel):
    """Payload for POST /auth/signup."""

    email: EmailStr
    password: str
    full_name: str
    phone: str | None = None
    role: RoleEnum = RoleEnum.Driver


class UserOut(BaseModel):
    """Public-facing representation of a user. Never includes the password."""

    user_id: UUID
    email: EmailStr
    full_name: str
    role: RoleEnum

    class Config:
        from_attributes = True


class Token(BaseModel):
    """Response for POST /auth/login."""

    access_token: str
    token_type: str
