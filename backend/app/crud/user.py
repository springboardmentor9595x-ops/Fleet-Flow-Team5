from sqlalchemy.orm import Session
from app.models.user import User
from app.core.security import hash_password


def get_user_by_email(db: Session, email: str):
    return db.query(User).filter(User.email == email).first()


def create_user(
    db: Session,
    email: str,
    password: str,
    full_name: str,
    phone: str | None,
    role,
    is_verified: bool = True,
    otp_code: str | None = None,
    otp_expires_at = None,
):
    user = User(
        email=email,
        password=hash_password(password),
        full_name=full_name,
        phone=phone,
        role=role,
        is_verified=is_verified,
        otp_code=otp_code,
        otp_expires_at=otp_expires_at,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
