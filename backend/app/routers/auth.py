"""
Auth Router — Login, Signup, Admin Add User, Email Logs.
"""
from typing import List, Optional
import random
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr

from app.database import get_db
from app.schemas.user import UserCreate, UserOut, Token, VerifyOTPRequest, ResendOTPRequest
from app.crud.user import get_user_by_email, create_user
from app.core.security import verify_password, create_access_token, hash_password

from app.core.deps import get_current_user
from app.models.user import User, RoleEnum
from app.models.driver import Driver

router = APIRouter()

# ── In-memory email audit log (session-scoped) ─────────────────────────────
_email_log: List[dict] = []
_log_counter = 0


def _append_email_log(
    recipient: str,
    recipient_name: str,
    role: str,
    subject: str,
    body_preview: str,
    added_by_admin: bool = False,
):
    global _log_counter
    _log_counter += 1
    _email_log.append({
        "id": _log_counter,
        "recipient": recipient,
        "recipient_name": recipient_name,
        "role": role,
        "subject": subject,
        "body_preview": body_preview,
        "status": "Sent",
        "added_by_admin": added_by_admin,
        "sent_at": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
    })


def _generate_otp() -> str:
    """Generate a random 6-digit numeric OTP code."""
    return f"{random.randint(100000, 999999)}"


def _send_otp_email_background(full_name: str, email: str, otp_code: str):
    """Send 6-digit OTP verification email via SMTP and log it."""
    body_preview = f"Your FleetFlow 6-digit verification code is {otp_code}. Valid for 10 minutes."
    try:
        import smtplib
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText
        from app.config import settings

        subject = f"FleetFlow — Your Verification OTP is {otp_code}"
        body_text = (
            f"Hello {full_name},\n\n"
            f"Thank you for registering on FleetFlow.\n"
            f"Your 6-digit email verification OTP is:\n\n"
            f"   {otp_code}\n\n"
            f"This code is valid for 10 minutes. Please enter this OTP in FleetFlow to verify your email and sign in.\n\n"
            f"If you did not request this code, please ignore this email.\n\n"
            f"— FleetFlow Logistics Security Team"
        )
        body_html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #E2E8F0; border-radius: 16px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #0F172A; margin: 0;">FleetFlow Security</h2>
            <p style="color: #64748B; font-size: 13px; margin-top: 4px;">Account Email Verification</p>
          </div>
          <p style="color: #334155; font-size: 14px;">Hello <strong>{full_name}</strong>,</p>
          <p style="color: #475569; font-size: 13px; line-height: 1.5;">
            Thank you for registering on FleetFlow. Use the 6-digit verification code below to verify your account and complete your sign-in:
          </p>
          <div style="text-align: center; margin: 24px 0;">
            <span style="display: inline-block; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #0D9488; background: #F0FDFA; padding: 14px 28px; border-radius: 12px; border: 1px dashed #0D9488;">
              {otp_code}
            </span>
          </div>
          <p style="color: #64748B; font-size: 12px; text-align: center;">
            This OTP is valid for <strong>10 minutes</strong>. Do not share this code with anyone.
          </p>
          <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 20px 0;" />
          <p style="color: #94A3B8; font-size: 11px; text-align: center;">
            FleetFlow Intelligent Logistics Platform
          </p>
        </div>
        """

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = getattr(settings, "EMAILS_FROM", "noreply@fleetflow.com")
        msg["To"] = email

        msg.attach(MIMEText(body_text, "plain"))
        msg.attach(MIMEText(body_html, "html"))

        with smtplib.SMTP(
            getattr(settings, "SMTP_HOST", "smtp.gmail.com"),
            int(getattr(settings, "SMTP_PORT", 587)),
        ) as server:
            server.starttls()
            smtp_user = getattr(settings, "SMTP_USER", "")
            smtp_pass = getattr(settings, "SMTP_PASSWORD", "")
            if smtp_user and smtp_pass:
                server.login(smtp_user, smtp_pass)
            server.sendmail(msg["From"], [email], msg.as_string())
    except Exception as exc:
        print(f"[OTP EMAIL] Send failed for {email}: {exc}")
    finally:
        _append_email_log(
            recipient=email,
            recipient_name=full_name,
            role="User",
            subject=f"FleetFlow — Your Verification OTP is {otp_code}",
            body_preview=body_preview,
            added_by_admin=False,
        )


def _send_welcome_email_background(
    full_name: str, email: str, role: str, password: Optional[str] = None
):
    """Simulate email dispatch and log it."""
    body_preview = f"Welcome email for {role}."
    try:
        import smtplib
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText
        from app.config import settings

        subject = f"Welcome to FleetFlow — Your {role} Account is Ready"
        if password:
            body = (
                f"Hello {full_name},\n\n"
                f"Your FleetFlow account has been provisioned by an Admin.\n\n"
                f"  Role: {role}\n"
                f"  Email: {email}\n"
                f"  Temporary Password: {password}\n\n"
                f"Please login at http://localhost:5173 and change your password immediately.\n\n"
                f"FleetFlow Logistics Team"
            )
            body_preview = f"Your account has been provisioned. Temporary password included. Role: {role}."
        else:
            body = (
                f"Hello {full_name},\n\n"
                f"Welcome to FleetFlow! Your account has been created successfully.\n\n"
                f"  Role: {role}\n"
                f"  Email: {email}\n\n"
                f"Login at http://localhost:5173 to get started.\n\n"
                f"FleetFlow Logistics Team"
            )
            body_preview = f"Welcome to FleetFlow! Your {role} account is ready. Login to get started."

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = getattr(settings, "EMAILS_FROM", "noreply@fleetflow.com")
        msg["To"] = email

        msg.attach(MIMEText(body, "plain"))

        with smtplib.SMTP(
            getattr(settings, "SMTP_HOST", "smtp.gmail.com"),
            int(getattr(settings, "SMTP_PORT", 587)),
        ) as server:
            server.starttls()
            smtp_user = getattr(settings, "SMTP_USER", "")
            smtp_pass = getattr(settings, "SMTP_PASSWORD", "")
            if smtp_user and smtp_pass:
                server.login(smtp_user, smtp_pass)
            server.sendmail(msg["From"], [email], msg.as_string())
    except Exception as exc:
        print(f"[EMAIL] Send failed for {email}: {exc}")
    finally:
        _append_email_log(
            recipient=email,
            recipient_name=full_name,
            role=role,
            subject=f"Welcome to FleetFlow — Your {role} Account is Ready",
            body_preview=body_preview,
            added_by_admin=password is not None,
        )


# ── Admin Add-User Request Schema ───────────────────────────────────────────
class AdminAddUserRequest(BaseModel):
    full_name: str
    email: str
    role: str = "Driver"
    temporary_password: str
    license_number: Optional[str] = None
    hub_location: Optional[str] = None


# ── Signup ──────────────────────────────────────────────────────────────────
@router.post("/signup", response_model=UserOut, status_code=status.HTTP_200_OK)
def signup(
    user_in: UserCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    existing_user = get_user_by_email(db, user_in.email)
    otp = _generate_otp()
    expires_at = datetime.utcnow() + timedelta(minutes=10)

    if existing_user:
        if existing_user.is_verified:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered. Please sign in.",
            )
        else:
            # User registered earlier but didn't verify OTP yet
            existing_user.full_name = user_in.full_name
            existing_user.password = hash_password(user_in.password)
            existing_user.role = user_in.role
            existing_user.phone = getattr(user_in, "phone", None)
            existing_user.otp_code = otp
            existing_user.otp_expires_at = expires_at
            db.commit()
            db.refresh(existing_user)
            user = existing_user
    else:
        user = create_user(
            db,
            email=user_in.email,
            password=user_in.password,
            full_name=user_in.full_name,
            phone=getattr(user_in, "phone", None),
            role=user_in.role,
            is_verified=False,
            otp_code=otp,
            otp_expires_at=expires_at,
        )

    # Send OTP verification email in background
    background_tasks.add_task(
        _send_otp_email_background,
        full_name=user.full_name,
        email=user.email,
        otp_code=otp,
    )
    return user


# ── Verify OTP & Sign In ───────────────────────────────────────────────────
@router.post("/verify-otp", response_model=Token)
def verify_otp(
    payload: VerifyOTPRequest,
    db: Session = Depends(get_db),
):
    """
    Verify the 6-digit OTP code sent during signup and automatically authenticate user.
    """
    user = get_user_by_email(db, payload.email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found. Please register first.",
        )

    if user.is_verified:
        token = create_access_token(data={"sub": user.email, "role": user.role.value if hasattr(user.role, "value") else str(user.role)})
        return {"access_token": token, "token_type": "bearer", "user": user}

    if not user.otp_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No pending OTP request found. Please click 'Resend OTP'.",
        )

    if user.otp_expires_at and datetime.utcnow() > user.otp_expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP code has expired. Please request a new OTP code.",
        )

    if str(user.otp_code).strip() != str(payload.otp).strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect OTP code. Please verify the code sent to your email.",
        )

    # Verification successful
    user.is_verified = True
    user.otp_code = None
    user.otp_expires_at = None
    db.commit()
    db.refresh(user)

    token = create_access_token(data={"sub": user.email, "role": user.role.value if hasattr(user.role, "value") else str(user.role)})
    return {"access_token": token, "token_type": "bearer", "user": user}


# ── Resend OTP ─────────────────────────────────────────────────────────────
@router.post("/resend-otp")
def resend_otp(
    payload: ResendOTPRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Resend a fresh 6-digit OTP to the user's email.
    """
    user = get_user_by_email(db, payload.email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found. Please sign up first.",
        )

    if user.is_verified:
        return {"message": "Email is already verified. You can proceed to Sign In.", "is_verified": True}

    otp = _generate_otp()
    user.otp_code = otp
    user.otp_expires_at = datetime.utcnow() + timedelta(minutes=10)
    db.commit()

    background_tasks.add_task(
        _send_otp_email_background,
        full_name=user.full_name,
        email=user.email,
        otp_code=otp,
    )
    return {"message": f"Fresh verification OTP dispatched to {user.email}.", "email": user.email}


# ── Login ────────────────────────────────────────────────────────────────────
@router.post("/login", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = get_user_by_email(db, form_data.username)
    if not user or not verify_password(form_data.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified. Please verify using the OTP sent to your email to sign in.",
        )
    token = create_access_token(data={"sub": user.email, "role": user.role.value if hasattr(user.role, "value") else str(user.role)})
    return {"access_token": token, "token_type": "bearer", "user": user}


# ── Get Current User ─────────────────────────────────────────────────────────
@router.get("/me", response_model=UserOut)
def read_current_user(current_user: User = Depends(get_current_user)):
    return current_user


# ── Admin: Add User ──────────────────────────────────────────────────────────
@router.post("/admin/add-user", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def admin_add_user(
    payload: AdminAddUserRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Admin-only endpoint to provision a new user account with a temporary password.
    Optionally creates a linked Driver record if role is Driver and license_number provided.
    Sends a welcome email with credentials in the background.
    """
    if current_user.role != RoleEnum.Admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Admin can provision user accounts.",
        )

    if get_user_by_email(db, payload.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Email '{payload.email}' is already registered.",
        )

    # Map string role to enum
    role_map = {
        "Admin": RoleEnum.Admin,
        "FleetManager": RoleEnum.FleetManager,
        "Dispatcher": RoleEnum.Dispatcher,
        "Driver": RoleEnum.Driver,
    }
    role_enum = role_map.get(payload.role, RoleEnum.Driver)

    user = create_user(
        db,
        email=payload.email,
        password=payload.temporary_password,
        full_name=payload.full_name,
        phone=None,
        role=role_enum,
    )

    # Auto-create Driver record if role is Driver and license number provided
    if role_enum == RoleEnum.Driver and payload.license_number:
        existing_driver = db.query(Driver).filter(Driver.license_number == payload.license_number).first()
        if not existing_driver:
            new_driver = Driver(
                user_id=user.user_id,
                license_number=payload.license_number,
                address=payload.hub_location or "",
                status="Active",
                experience_years=0,
            )
            db.add(new_driver)
            db.commit()

    # Send welcome email with temp password in background
    background_tasks.add_task(
        _send_welcome_email_background,
        full_name=user.full_name,
        email=user.email,
        role=user.role.value if hasattr(user.role, "value") else str(user.role),
        password=payload.temporary_password,
    )

    return user


# ── Admin: Email Logs ────────────────────────────────────────────────────────
@router.get("/email-logs")
def get_email_logs(
    current_user: User = Depends(get_current_user),
):
    """
    Returns audit log of all emails dispatched this session. Admin only.
    """
    if current_user.role != RoleEnum.Admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Admin can view email logs.",
        )
    return list(reversed(_email_log))  # Most recent first


# ── Admin: User Management Endpoints ──────────────────────────────────────────
@router.get("/users", response_model=List[UserOut])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin-only endpoint to list all system users."""
    if current_user.role != RoleEnum.Admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Admin can view all system users.",
        )
    return db.query(User).order_by(User.full_name.asc()).all()


class RoleUpdatePayload(BaseModel):
    role: str


@router.patch("/users/{user_id}/role", response_model=UserOut)
def update_user_role(
    user_id: str,
    payload: RoleUpdatePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin-only endpoint to change a user's role."""
    if current_user.role != RoleEnum.Admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Admin can change user roles.",
        )
    
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    role_map = {
        "Admin": RoleEnum.Admin,
        "FleetManager": RoleEnum.FleetManager,
        "Dispatcher": RoleEnum.Dispatcher,
        "Driver": RoleEnum.Driver,
    }
    new_role = role_map.get(payload.role)
    if not new_role:
        raise HTTPException(status_code=400, detail=f"Invalid role '{payload.role}'.")

    user.role = new_role
    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin-only endpoint to permanently delete a user account."""
    if current_user.role != RoleEnum.Admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Admin can delete user accounts.",
        )

    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if user.user_id == current_user.user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own admin account.")

    db.delete(user)
    db.commit()
    return None

