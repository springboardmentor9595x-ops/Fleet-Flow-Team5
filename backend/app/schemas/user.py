from uuid import UUID
from pydantic import BaseModel, ConfigDict, EmailStr
from app.models.user import RoleEnum


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: str | None = None
    role: RoleEnum = RoleEnum.Driver


class UserOut(BaseModel):
    user_id: UUID
    email: EmailStr
    full_name: str
    role: RoleEnum

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserOut | None = None

