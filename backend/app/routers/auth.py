import re
from fastapi import APIRouter, Depends, Form, HTTPException, Query, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.core.security import create_access_token, verify_password
from app.crud import user as user_crud
from app.models.user import User
from app.schemas.user import (
    ResendVerificationRequest,
    ResendVerificationResponse,
    SignupResponse,
    Token,
    UserCreate,
    UserRead,
    VerificationResponse,
)
from app.services.email import send_verification_email

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

router = APIRouter(tags=["auth"])


@router.post("/signup", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
def signup(user_in: UserCreate, db: Session = Depends(get_db)) -> SignupResponse:
    existing_user = user_crud.get_user_by_email(db, user_in.email)
    if existing_user:
        if existing_user.is_verified:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email is already registered. Please log in.",
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This email is already registered but not verified. Please verify your email address or resend the verification email.",
            )

    # 1. Create user with is_verified = False
    user = user_crud.create_user(db, user_in, is_verified=False)

    # 2. Generate cryptographically secure token and store SHA-256 hash in DB
    raw_token = user_crud.create_verification_token_record(db, user.user_id)

    # 3. Send verification email (gracefully logs in dev if SMTP unconfigured)
    send_verification_email(user.email, raw_token, user.full_name)

    return SignupResponse(
        message="Account created. Please verify your email address before logging in.",
        user=user,
    )


@router.post("/login", response_model=Token)
def login(
    username: str = Form(default=""),
    password: str = Form(default=""),
    grant_type: str | None = Form(default=None),
    scope: str = Form(default=""),
    client_id: str | None = Form(default=None),
    client_secret: str | None = Form(default=None),
    db: Session = Depends(get_db),
) -> Token:
    email = username.strip()
    pwd = password

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email address is required.",
        )

    if not EMAIL_REGEX.match(email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please enter a valid email address.",
        )

    if not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password is required.",
        )

    user = user_crud.get_user_by_email(db, email)

    if not user or not verify_password(password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    # Enforce email verification restriction
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Verify your email address before logging in.",
        )

    access_token = create_access_token(subject=user.email)
    return Token(access_token=access_token)


@router.get("/me", response_model=UserRead)
def get_me(current_user: User = Depends(get_current_user)) -> UserRead:
    return current_user


@router.get("/verify-email", response_model=VerificationResponse)
def verify_email(
    token: str = Query(..., description="Email verification token"),
    db: Session = Depends(get_db),
) -> VerificationResponse:
    verify_status, user = user_crud.verify_email_by_token(db, token)

    if verify_status == "SUCCESS":
        return VerificationResponse(
            message="Email verified successfully.",
            status="success",
        )
    elif verify_status == "ALREADY_VERIFIED":
        return VerificationResponse(
            message="Email address is already verified.",
            status="already_verified",
        )
    elif verify_status == "EXPIRED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification link has expired. Please request a new verification email.",
        )
    elif verify_status == "ALREADY_USED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This verification link has already been used.",
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification link.",
        )


@router.post("/resend-verification", response_model=ResendVerificationResponse)
def resend_verification(
    payload: ResendVerificationRequest,
    db: Session = Depends(get_db),
) -> ResendVerificationResponse:
    user = user_crud.get_user_by_email(db, payload.email)

    from app.config import settings

    if not settings.SMTP_HOST:
        dev_msg = "Verification link generated. Check the development server console."
    else:
        dev_msg = "Verification email sent. Please check your inbox."

    if not user:
        return ResendVerificationResponse(message=dev_msg)

    if user.is_verified:
        return ResendVerificationResponse(message="Email address is already verified.")

    # Check cooldown
    can_resend, remaining_seconds = user_crud.can_resend_verification(db, user.user_id)
    if not can_resend:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Please wait {remaining_seconds} seconds before requesting another verification email.",
        )

    # Invalidate old token and create new
    raw_token = user_crud.create_verification_token_record(db, user.user_id)
    send_verification_email(user.email, raw_token, user.full_name)

    return ResendVerificationResponse(message=dev_msg)

