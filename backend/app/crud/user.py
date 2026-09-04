from datetime import datetime, timedelta, timezone
from uuid import UUID
from sqlalchemy.orm import Session

from app.config import settings
from app.core.security import generate_verification_token, hash_password, hash_verification_token, verify_password
from app.models.email_verification import EmailVerificationToken
from app.models.user import User
from app.schemas.user import UserCreate


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email.strip().lower()).first()


def get_user_by_id(db: Session, user_id: UUID) -> User | None:
    return db.query(User).filter(User.user_id == user_id).first()


def create_user(
    db: Session,
    user_in: UserCreate,
    is_verified: bool = False,
    role: str = "Driver",
) -> User:
    # Always enforce Driver role for public registrations
    enforced_role = role or "Driver"
    user = User(
        full_name=user_in.full_name,
        email=user_in.email.strip().lower(),
        password=hash_password(user_in.password),
        phone=user_in.phone,
        role=enforced_role,
        is_verified=is_verified,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # If the user registered as a Driver, create Driver record
    if user.role == "Driver":
        from app.models.driver import Driver
        existing_driver = db.query(Driver).filter(Driver.user_id == user.user_id).first()
        if not existing_driver:
            driver = Driver(user_id=user.user_id, status="Active")
            db.add(driver)
            db.commit()

    return user


def create_verification_token_record(db: Session, user_id: UUID) -> str:
    """
    Invalidates any previous unused codes for the user and generates a new
    6-digit verification code whose SHA-256 hash is saved to the database.
    Returns the raw 6-digit code to be sent to the user.
    """
    # Invalidate previous unused codes for this user
    db.query(EmailVerificationToken).filter(
        EmailVerificationToken.user_id == user_id,
        EmailVerificationToken.is_used == False,
    ).update({"is_used": True})

    raw_code = generate_verification_token()  # Returns 6-digit code
    token_hash = hash_verification_token(raw_code)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.EMAIL_VERIFICATION_EXPIRE_MINUTES)

    token_record = EmailVerificationToken(
        user_id=user_id,
        token_hash=token_hash,
        expires_at=expires_at,
        is_used=False,
    )
    db.add(token_record)
    db.commit()

    return raw_code


def can_resend_verification(db: Session, user_id: UUID) -> tuple[bool, int]:
    """
    Checks if a user is in the cooldown window for resending verification codes.
    Returns (can_resend: bool, remaining_seconds: int).
    """
    recent_token = (
        db.query(EmailVerificationToken)
        .filter(EmailVerificationToken.user_id == user_id)
        .order_by(EmailVerificationToken.created_at.desc())
        .first()
    )
    if not recent_token:
        return True, 0

    now = datetime.now(timezone.utc)
    token_time = recent_token.created_at
    if token_time.tzinfo is None:
        token_time = token_time.replace(tzinfo=timezone.utc)

    elapsed_seconds = (now - token_time).total_seconds()
    cooldown = settings.RESEND_COOLDOWN_SECONDS
    if elapsed_seconds < cooldown:
        return False, int(cooldown - elapsed_seconds)

    return True, 0


def verify_email_by_code(db: Session, email: str, code: str) -> tuple[str, User | None]:
    """
    Validates a 6-digit verification code by SHA-256 hash against the user's active code record.
    Returns status code and User (if resolved).
    Status codes: 'SUCCESS', 'ALREADY_VERIFIED', 'ALREADY_USED', 'EXPIRED', 'INVALID'
    """
    cleaned_code = (code or "").strip()
    cleaned_email = (email or "").strip().lower()

    if not cleaned_code or not cleaned_email or len(cleaned_code) != 6:
        return "INVALID", None

    user = get_user_by_email(db, cleaned_email)
    if not user:
        return "INVALID", None

    if user.is_verified:
        return "ALREADY_VERIFIED", user

    token_hash = hash_verification_token(cleaned_code)

    # Find token record matching user_id and token_hash
    token_record = (
        db.query(EmailVerificationToken)
        .filter(
            EmailVerificationToken.user_id == user.user_id,
            EmailVerificationToken.token_hash == token_hash,
        )
        .order_by(EmailVerificationToken.created_at.desc())
        .first()
    )

    if not token_record:
        return "INVALID", user

    if token_record.is_used:
        return "ALREADY_USED", user

    # Check expiration (15 minutes)
    now = datetime.now(timezone.utc)
    expires_at = token_record.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if now > expires_at:
        return "EXPIRED", user

    # Mark user verified and token as used
    user.is_verified = True
    token_record.is_used = True
    db.commit()
    db.refresh(user)

    return "SUCCESS", user


def verify_email_by_token(db: Session, raw_token: str) -> tuple[str, User | None]:
    """Fallback wrapper for backwards compatibility."""
    if not raw_token or not raw_token.strip():
        return "INVALID", None

    token_hash = hash_verification_token(raw_token.strip())
    token_record = (
        db.query(EmailVerificationToken)
        .filter(EmailVerificationToken.token_hash == token_hash)
        .order_by(EmailVerificationToken.created_at.desc())
        .first()
    )

    if not token_record:
        return "INVALID", None

    user = get_user_by_id(db, token_record.user_id)
    if not user:
        return "INVALID", None

    if user.is_verified:
        return "ALREADY_VERIFIED", user

    if token_record.is_used:
        return "ALREADY_USED", user

    now = datetime.now(timezone.utc)
    expires_at = token_record.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if now > expires_at:
        return "EXPIRED", user

    user.is_verified = True
    token_record.is_used = True
    db.commit()
    db.refresh(user)

    return "SUCCESS", user



def authenticate_user(db: Session, email: str, password: str) -> User | None:
    user = get_user_by_email(db, email)
    if not user:
        return None
    if not verify_password(password, user.password):
        return None
    return user


from app.models.driver import Driver
from app.models.vehicle import Vehicle
from app.schemas.user import DriverProfileRead, UserProfileUpdate, UserRead
from sqlalchemy import or_


def build_user_profile_response(db: Session, user: User) -> UserRead:
    driver_info = None

    if user.role == "Driver":
        driver = db.query(Driver).filter(Driver.user_id == user.user_id).first()
        if driver:
            veh = db.query(Vehicle).filter(
                or_(Vehicle.assigned_driver == driver.driver_id, Vehicle.assigned_driver == user.user_id)
            ).first()

            reg = veh.registration_number if veh else None
            bm = f"{veh.brand or ''} {veh.model or ''}".strip() if veh else None

            driver_info = DriverProfileRead(
                driver_id=driver.driver_id,
                license_number=driver.license_number,
                experience_years=driver.experience_years,
                address=driver.address or user.address,
                status=driver.status,
                assigned_vehicle_registration=reg,
                assigned_vehicle_brand_model=bm if bm else None,
            )

    return UserRead(
        user_id=user.user_id,
        full_name=user.full_name,
        email=user.email,
        phone=user.phone,
        address=user.address,
        emergency_contact=user.emergency_contact,
        profile_photo=user.profile_photo,
        role=str(user.role.value if hasattr(user.role, "value") else user.role),
        is_verified=user.is_verified,
        email_verified=user.is_verified,
        created_at=user.created_at,
        updated_at=user.updated_at,
        driver_details=driver_info,
    )


def update_user_profile(db: Session, user: User, profile_in: UserProfileUpdate) -> UserRead:
    """Updates ONLY permitted personal information. Explicitly ignores protected fields."""
    if profile_in.full_name is not None and profile_in.full_name.strip():
        user.full_name = profile_in.full_name.strip()

    if profile_in.phone is not None:
        user.phone = profile_in.phone.strip() if profile_in.phone.strip() else None

    if profile_in.address is not None:
        user.address = profile_in.address.strip() if profile_in.address.strip() else None

    if profile_in.emergency_contact is not None:
        user.emergency_contact = profile_in.emergency_contact.strip() if profile_in.emergency_contact.strip() else None

    if profile_in.profile_photo is not None:
        user.profile_photo = profile_in.profile_photo.strip() if profile_in.profile_photo.strip() else None

    db.add(user)
    db.commit()
    db.refresh(user)

    return build_user_profile_response(db, user)


from fastapi import HTTPException, status

def change_user_password(db: Session, user: User, current_password: str, new_password: str) -> None:
    if not verify_password(current_password, user.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )

    user.password = hash_password(new_password)
    db.add(user)
    db.commit()

