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


def create_user(db: Session, user_in: UserCreate, is_verified: bool = False) -> User:
    user = User(
        full_name=user_in.full_name,
        email=user_in.email.strip().lower(),
        password=hash_password(user_in.password),
        phone=user_in.phone,
        role=user_in.role,
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
    Invalidates any previous unused tokens for the user and generates a new
    secure raw token whose SHA-256 hash is saved to the database.
    Returns the raw token to be sent to the user.
    """
    # Invalidate previous unused tokens for this user
    db.query(EmailVerificationToken).filter(
        EmailVerificationToken.user_id == user_id,
        EmailVerificationToken.is_used == False,
    ).update({"is_used": True})

    raw_token = generate_verification_token()
    token_hash = hash_verification_token(raw_token)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=settings.EMAIL_VERIFICATION_EXPIRE_HOURS)

    token_record = EmailVerificationToken(
        user_id=user_id,
        token_hash=token_hash,
        expires_at=expires_at,
        is_used=False,
    )
    db.add(token_record)
    db.commit()

    return raw_token


def can_resend_verification(db: Session, user_id: UUID) -> tuple[bool, int]:
    """
    Checks if a user is in the cooldown window for resending verification emails.
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


def verify_email_by_token(db: Session, raw_token: str) -> tuple[str, User | None]:
    """
    Validates a raw token by SHA-256 hash against the database.
    Returns status code and User (if resolved).
    Status codes: 'SUCCESS', 'ALREADY_VERIFIED', 'ALREADY_USED', 'EXPIRED', 'INVALID'
    """
    if not raw_token or not raw_token.strip():
        return "INVALID", None

    token_hash = hash_verification_token(raw_token.strip())
    token_record = (
        db.query(EmailVerificationToken)
        .filter(EmailVerificationToken.token_hash == token_hash)
        .first()
    )

    if not token_record:
        return "INVALID", None

    user = get_user_by_id(db, token_record.user_id)
    if not user:
        return "INVALID", None

    if user.is_verified:
        # Mark token used if not already
        if not token_record.is_used:
            token_record.is_used = True
            db.commit()
        return "ALREADY_VERIFIED", user

    if token_record.is_used:
        return "ALREADY_USED", user

    # Check expiration
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


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    user = get_user_by_email(db, email)
    if not user:
        return None
    if not verify_password(password, user.password):
        return None
    return user

