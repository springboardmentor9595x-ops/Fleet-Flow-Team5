from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, EmailStr
from app.models.user import RoleEnum


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: Optional[str] = None
    role: RoleEnum = RoleEnum.Driver


class UserOut(BaseModel):
    user_id: UUID
    email: EmailStr
    full_name: str
    role: RoleEnum
    is_verified: bool = True

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str
    user: Optional[UserOut] = None


class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp: str


class ResendOTPRequest(BaseModel):
    email: EmailStr

