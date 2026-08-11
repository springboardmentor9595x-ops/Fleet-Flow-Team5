"""
Auth Router — Login, Signup, Admin Add User, Email Logs.
"""
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr

from app.database import get_db
from app.schemas.user import UserCreate, UserOut, Token
from app.crud.user import get_user_by_email, create_user
from app.core.security import verify_password, create_access_token

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


def _send_welcome_email_background(
    full_name: str, email: str, role: str, password: Optional[str] = None
):
    """Simulate email dispatch and log it."""
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
            body_preview=body_preview if 'body_preview' in dir() else f"Welcome email for {role}.",
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
    if get_user_by_email(db, user_in.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
    user = create_user(
        db,
        email=user_in.email,
        password=user_in.password,
        full_name=user_in.full_name,
        phone=getattr(user_in, "phone", None),
        role=user_in.role,
    )
    background_tasks.add_task(
        _send_welcome_email_background,
        full_name=user.full_name,
        email=user.email,
        role=user.role.value if hasattr(user.role, "value") else str(user.role),
        password=None,
    )
    return user


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
    token = create_access_token(data={"sub": user.email, "role": user.role.value})
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
    if current_user.role not in (RoleEnum.Admin, RoleEnum.FleetManager):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Admin or FleetManager can provision accounts.",
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
    Returns audit log of all emails dispatched this session (signup welcome emails + admin provisions).
    Admin/FleetManager only.
    """
    if current_user.role not in (RoleEnum.Admin, RoleEnum.FleetManager):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Admin or FleetManager can view email logs.",
        )
    return list(reversed(_email_log))  # Most recent first
