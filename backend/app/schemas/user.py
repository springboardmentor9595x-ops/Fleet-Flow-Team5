import re
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class UserCreate(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., max_length=128)
    phone: str | None = None
    role: Literal["Admin", "FleetManager", "Driver", "Dispatcher"] = "Driver"

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, value: str) -> str:
        if len(value) < 8:
            raise ValueError("Password must be at least 8 characters long")
        if not re.search(r"[A-Z]", value):
            raise ValueError("Password must include at least one uppercase letter")
        if not re.search(r"[a-z]", value):
            raise ValueError("Password must include at least one lowercase letter")
        if not re.search(r"\d", value):
            raise ValueError("Password must include at least one number")
        if not re.search(r"[^A-Za-z0-9]", value):
            raise ValueError("Password must include at least one special character")
        return value


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class SignupResponse(BaseModel):
    message: str = "Account created successfully. Please verify your email address to continue."
    user: "UserRead"


class VerificationResponse(BaseModel):
    message: str
    status: str = "success"


class VerifyEmailRequest(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")



from datetime import datetime

class ResendVerificationRequest(BaseModel):
    email: EmailStr


class ResendVerificationResponse(BaseModel):
    message: str


class UserRoleUpdate(BaseModel):
    role: Literal["Admin", "FleetManager", "Dispatcher", "Driver"]


class UserProfileUpdate(BaseModel):
    full_name: str | None = Field(None, min_length=2, max_length=100)
    phone: str | None = Field(None, max_length=20)
    address: str | None = Field(None, max_length=255)
    emergency_contact: str | None = Field(None, max_length=100)
    profile_photo: str | None = Field(None, max_length=500)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., max_length=128)
    confirm_password: str = Field(..., max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_password_strength(cls, value: str) -> str:
        if len(value) < 8:
            raise ValueError("Password must be at least 8 characters long")
        if not re.search(r"[A-Z]", value):
            raise ValueError("Password must include at least one uppercase letter")
        if not re.search(r"[a-z]", value):
            raise ValueError("Password must include at least one lowercase letter")
        if not re.search(r"\d", value):
            raise ValueError("Password must include at least one number")
        if not re.search(r"[^A-Za-z0-9]", value):
            raise ValueError("Password must include at least one special character")
        return value


class DriverProfileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    driver_id: UUID | None = None
    license_number: str | None = None
    experience_years: int | None = None
    address: str | None = None
    status: str | None = None
    assigned_vehicle_registration: str | None = None
    assigned_vehicle_brand_model: str | None = None


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: UUID
    full_name: str
    email: EmailStr
    phone: str | None = None
    address: str | None = None
    emergency_contact: str | None = None
    profile_photo: str | None = None
    role: str
    is_verified: bool
    email_verified: bool | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    driver_details: DriverProfileRead | None = None

