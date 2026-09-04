import logging
import re
from fastapi import APIRouter, Depends, Form, HTTPException, Query, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.core.security import create_access_token, verify_password
from app.crud import user as user_crud
from app.models.user import User
from app.schemas.user import (
    ChangePasswordRequest,
    ResendVerificationRequest,
    ResendVerificationResponse,
    SignupResponse,
    Token,
    UserCreate,
    UserProfileUpdate,
    UserRead,
    VerificationResponse,
    VerifyEmailRequest,
)
from app.services.email import send_verification_email

logger = logging.getLogger("fleetflow.auth")
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
                detail="This email is already registered but not verified. Please enter your verification code or request a new one.",
            )

    # 1. Create user with is_verified = False, strictly enforcing role = 'Driver'
    user = user_crud.create_user(db, user_in, is_verified=False, role="Driver")

    # 2. Generate 6-digit code and store SHA-256 hash in DB
    raw_code = user_crud.create_verification_token_record(db, user.user_id)

    # 3. Send verification email via SMTP
    sent_success, send_msg = send_verification_email(user.email, raw_code, user.full_name)
    if not sent_success:
        db.delete(user)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to send verification email. Please try again.",
        )

    return SignupResponse(
        message="Account created. Verification code sent to your email.",
        user=user,
    )


@router.post("/login", response_model=Token)
def login(
    username: str = Form(default=""),
    password: str = Form(default=""),
    role: str | None = Form(default=None),
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

    if not user:
        logger.warning(f"[AUTH LOGIN 401] Account email '{email}' not found in database.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not verify_password(password, user.password):
        logger.warning(f"[AUTH LOGIN 401] Password mismatch for email '{email}'.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    # Enforce email verification restriction
    if not user.is_verified:
        logger.warning(f"[AUTH LOGIN 403] Account '{email}' is not verified.")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Verify your email address before logging in.",
        )

    # Validate selected role against authoritative database user role
    if role and role.strip():
        selected_role_clean = role.strip()
        db_role_str = str(user.role.value if hasattr(user.role, "value") else user.role)

        norm_selected = selected_role_clean.replace(" ", "").lower()
        norm_db = db_role_str.replace(" ", "").lower()

        if norm_selected != norm_db:
            actual_role_display = "Fleet Manager" if norm_db == "fleetmanager" else db_role_str
            logger.warning(
                f"[AUTH LOGIN 400] Role mismatch for '{email}'. Selected: '{selected_role_clean}', DB: '{db_role_str}'."
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Role mismatch. This account is registered as {actual_role_display}.",
            )

    access_token = create_access_token(subject=user.email)
    return Token(access_token=access_token)


@router.get("/me", response_model=UserRead)
def get_me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserRead:
    return user_crud.build_user_profile_response(db, current_user)


@router.put("/me", response_model=UserRead)
def update_my_profile(
    profile_in: UserProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserRead:
    """
    Update authenticated user's permitted personal profile fields.
    Protected fields (email, role, status, is_verified, user_id) are strictly read-only and ignored.
    """
    return user_crud.update_user_profile(db, current_user, profile_in)


@router.post("/change-password")
def change_my_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Securely change current user's account password."""
    if payload.new_password != payload.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password and confirm password do not match.",
        )

    user_crud.change_user_password(
        db=db,
        user=current_user,
        current_password=payload.current_password,
        new_password=payload.new_password,
    )
    return {"message": "Password changed successfully."}


@router.post("/verify-email", response_model=VerificationResponse)
def verify_email_post(
    payload: VerifyEmailRequest,
    db: Session = Depends(get_db),
) -> VerificationResponse:
    """Validate 6-digit verification code for a user email."""
    verify_status, user = user_crud.verify_email_by_code(db, payload.email, payload.code)

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
            detail="Verification code has expired. Please request a new code.",
        )
    elif verify_status == "ALREADY_USED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This verification code has already been used.",
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code. Please check and try again.",
        )


@router.get("/verify-email", response_model=VerificationResponse)
def verify_email_get(
    token: str = Query(..., description="Email verification code"),
    email: str | None = Query(None, description="User email"),
    db: Session = Depends(get_db),
) -> VerificationResponse:
    """GET endpoint fallback for backward compatibility."""
    if email and email.strip():
        verify_status, user = user_crud.verify_email_by_code(db, email, token)
    else:
        verify_status, user = user_crud.verify_email_by_token(db, token)

    if verify_status == "SUCCESS":
        return VerificationResponse(message="Email verified successfully.", status="success")
    elif verify_status == "ALREADY_VERIFIED":
        return VerificationResponse(message="Email address is already verified.", status="already_verified")
    elif verify_status == "EXPIRED":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Verification code has expired.")
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid verification code.")


@router.post("/resend-verification", response_model=ResendVerificationResponse)
def resend_verification(
    payload: ResendVerificationRequest,
    db: Session = Depends(get_db),
) -> ResendVerificationResponse:
    user = user_crud.get_user_by_email(db, payload.email)

    if not user:
        return ResendVerificationResponse(message="Verification code sent to your email if the address is registered.")

    if user.is_verified:
        return ResendVerificationResponse(message="Email address is already verified.")

    # Check cooldown
    can_resend, remaining_seconds = user_crud.can_resend_verification(db, user.user_id)
    if not can_resend:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Please wait {remaining_seconds} seconds before requesting another verification code.",
        )

    # Invalidate old code and create new 6-digit code
    raw_code = user_crud.create_verification_token_record(db, user.user_id)
    sent_success, send_msg = send_verification_email(user.email, raw_code, user.full_name)
    if not sent_success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to send verification email. Please try again.",
        )

    return ResendVerificationResponse(message="Verification code sent to your email.")


