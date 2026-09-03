from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict
from app.models.user import RoleEnum


class UserCreate(BaseModel):
    email: str
    password: str
    full_name: str
    phone: Optional[str] = None
    role: RoleEnum = RoleEnum.Driver


class UserOut(BaseModel):
    user_id: UUID
    email: str
    full_name: str
    phone: Optional[str] = None
    role: RoleEnum
    is_verified: bool = True

    model_config = ConfigDict(from_attributes=True)


class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None


class AdminUserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[RoleEnum] = None


class Token(BaseModel):
    access_token: str
    token_type: str
    user: Optional[UserOut] = None


class VerifyOTPRequest(BaseModel):
    email: str
    otp: str


class ResendOTPRequest(BaseModel):
    email: str

