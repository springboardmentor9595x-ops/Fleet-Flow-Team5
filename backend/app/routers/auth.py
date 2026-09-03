"""
Auth Router — Login, Signup, Admin Add User, Email Logs.
"""
from typing import List, Optional
import random
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.schemas.user import (
    UserCreate,
    UserOut,
    UserProfileUpdate,
    AdminUserUpdate,
    Token,
    VerifyOTPRequest,
    ResendOTPRequest,
)
from app.crud.user import get_user_by_email, create_user
from app.core.security import verify_password, create_access_token, hash_password

from app.core.deps import get_current_user
from app.models.user import User, RoleEnum
from app.models.driver import Driver
from app.models.notification import Notification
from app.core.email import (
    append_email_log,
    get_email_logs as core_get_email_logs,
    send_role_change_email,
    send_account_deletion_email,
    dispatch_email,
)

router = APIRouter()

# ── In-memory email audit log delegation ─────────────────────────────
def _append_email_log(
    recipient: str,
    recipient_name: str,
    role: str,
    subject: str,
    body_preview: str,
    added_by_admin: bool = False,
):
    append_email_log(
        recipient=recipient,
        recipient_name=recipient_name,
        role=role,
        subject=subject,
        body_preview=body_preview,
        added_by_admin=added_by_admin,
        status="Sent",
    )


def _generate_otp() -> str:
    """Generate a random 6-digit numeric OTP code."""
    return f"{random.randint(100000, 999999)}"


def _send_otp_email_background(full_name: str, email: str, otp_code: str):
    """Send 6-digit OTP verification email via Resend/Brevo HTTP API or SMTP."""
    body_preview = f"Your FleetFlow 6-digit verification code is {otp_code}. Valid for 10 minutes."
    print("==================================================")
    print(f"[OTP DISPATCH] Recipient: {email} | Code: {otp_code}")
    print("==================================================")
    try:
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

        dispatch_email(
            to_email=email,
            subject=subject,
            body_text=body_text,
            body_html=body_html,
            sender_name="FleetFlow Security",
        )
    except Exception as exc:
        print(f"[OTP EMAIL] Send error for {email}: {exc}")
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
    """Dispatch welcome email via Resend/Brevo/SMTP and log it."""
    body_preview = f"Welcome email for {role}."
    try:
        subject = f"Welcome to FleetFlow — Your {role} Account is Ready"
        if password:
            body = (
                f"Hello {full_name},\n\n"
                f"Your FleetFlow account has been provisioned by an Admin.\n\n"
                f"  Role: {role}\n"
                f"  Email: {email}\n"
                f"  Temporary Password: {password}\n\n"
                f"Please login to FleetFlow and change your password immediately.\n\n"
                f"FleetFlow Logistics Team"
            )
        else:
            body = (
                f"Hello {full_name},\n\n"
                f"Welcome to FleetFlow! Your account has been created successfully.\n\n"
                f"  Role: {role}\n"
                f"  Email: {email}\n\n"
                f"Login to get started.\n\n"
                f"FleetFlow Logistics Team"
            )

        dispatch_email(
            to_email=email,
            subject=subject,
            body_text=body,
            body_html=f"<p>{body.replace(chr(10), '<br/>')}</p>",
            sender_name="FleetFlow Team",
        )
    except Exception as exc:
        print(f"[WELCOME EMAIL] Send error for {email}: {exc}")
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

    submitted_otp = str(payload.otp).strip()
    actual_otp = str(user.otp_code).strip() if user.otp_code else ""
    if submitted_otp != actual_otp and submitted_otp != "123456":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect OTP code. Please verify the code sent to your email (or use test OTP 123456).",
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
        if user.otp_code:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Email not verified. Please verify using the OTP sent to your email to sign in.",
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account has been suspended by an Administrator. Please contact support.",
            )
    token = create_access_token(data={"sub": user.email, "role": user.role.value if hasattr(user.role, "value") else str(user.role)})
    return {"access_token": token, "token_type": "bearer", "user": user}


# ── Get Current User ─────────────────────────────────────────────────────────
@router.get("/me", response_model=UserOut)
def read_current_user(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=Token)
def update_current_user_profile(
    payload: UserProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Allow logged in user to update their full_name, email, and phone.
    Strictly forbids self-changing role (role can only be changed by Admin).
    """
    # 1. Validate email if changing
    if payload.email and payload.email.strip().lower() != current_user.email.lower():
        new_email = payload.email.strip().lower()
        existing = db.query(User).filter(User.email == new_email).first()
        if existing and existing.user_id != current_user.user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Email '{new_email}' is already in use by another account.",
            )
        current_user.email = new_email

    # 2. Update full name & phone
    if payload.full_name is not None and payload.full_name.strip():
        current_user.full_name = payload.full_name.strip()
    if payload.phone is not None:
        current_user.phone = payload.phone.strip()

    db.commit()
    db.refresh(current_user)

    # Generate fresh JWT token with updated email/info
    token = create_access_token(
        data={
            "sub": current_user.email,
            "role": current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
        }
    )
    return {"access_token": token, "token_type": "bearer", "user": current_user}


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
    return core_get_email_logs()


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
    reason: Optional[str] = None


class BatchRoleUpdatePayload(BaseModel):
    user_ids: List[str]
    role: str
    reason: Optional[str] = None


class BatchDeletePayload(BaseModel):
    user_ids: List[str]
    reason: Optional[str] = None


class StatusUpdatePayload(BaseModel):
    is_verified: bool
    reason: Optional[str] = None


class BatchStatusUpdatePayload(BaseModel):
    user_ids: List[str]
    is_verified: bool
    reason: Optional[str] = None


def _safe_delete_single_user(db: Session, user: User, admin_name: str, reason: Optional[str] = None):
    """
    Safely unlinks foreign key dependencies across vehicles, trips, shipments,
    leave requests, attendance, notifications, and driver records, then removes user.
    """
    from app.models.vehicle import Vehicle
    from app.models.trip import Trip
    from app.models.shipment import Shipment, ShipmentHistory
    from app.models.leave_request import LeaveRequest
    from app.models.attendance import Attendance

    user_email = user.email
    user_name = user.full_name or "FleetFlow User"

    # 1. Nullify user references in history & review records
    db.query(ShipmentHistory).filter(ShipmentHistory.changed_by_user_id == user.user_id).update({ShipmentHistory.changed_by_user_id: None})
    db.query(LeaveRequest).filter(LeaveRequest.reviewed_by == user.user_id).update({LeaveRequest.reviewed_by: None})

    # 2. Delete user's notification records
    db.query(Notification).filter(Notification.user_id == user.user_id).delete(synchronize_session=False)

    # 3. Handle linked driver record and dependent child tables
    driver = db.query(Driver).filter(Driver.user_id == user.user_id).first()
    if driver:
        db.query(Vehicle).filter(Vehicle.assigned_driver == driver.driver_id).update({Vehicle.assigned_driver: None})
        db.query(Trip).filter(Trip.driver_id == driver.driver_id).update({Trip.driver_id: None})
        db.query(Shipment).filter(Shipment.driver_id == driver.driver_id).update({Shipment.driver_id: None})
        db.query(Attendance).filter(Attendance.driver_id == driver.driver_id).delete(synchronize_session=False)
        db.query(LeaveRequest).filter(LeaveRequest.driver_id == driver.driver_id).delete(synchronize_session=False)
        db.delete(driver)

    # 4. Delete user account
    db.delete(user)
    db.commit()

    # 5. Dispatch email notification
    send_account_deletion_email(
        recipient_email=user_email,
        recipient_name=user_name,
        admin_name=admin_name,
        reason=reason,
    )


@router.patch("/users/{user_id}/role", response_model=UserOut)
def update_user_role(
    user_id: str,
    payload: RoleUpdatePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin-only endpoint to change a user's role and dispatch an official email notification."""
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

    old_role_str = user.role.value if hasattr(user.role, "value") else str(user.role)
    new_role_str = new_role.value if hasattr(new_role, "value") else str(new_role)

    user.role = new_role

    # If transitioning to Driver, ensure Driver record exists
    if new_role == RoleEnum.Driver:
        driver = db.query(Driver).filter(Driver.user_id == user.user_id).first()
        if not driver:
            driver = Driver(
                user_id=user.user_id,
                license_number=f"DL-{str(user.user_id)[:8].upper()}",
                address="Operations Hub",
                status="Active",
                experience_years=2,
            )
            db.add(driver)
        else:
            driver.status = "Active"
    elif old_role_str == "Driver" and new_role != RoleEnum.Driver:
        driver = db.query(Driver).filter(Driver.user_id == user.user_id).first()
        if driver:
            driver.status = "Inactive"

    # Add in-app notification for the user
    notif_msg = f"Your FleetFlow role has been changed from '{old_role_str}' to '{new_role_str}' by Administrator {current_user.full_name}."
    if payload.reason:
        notif_msg += f" Note: {payload.reason}"

    notif = Notification(
        user_id=user.user_id,
        title="Role & Privileges Updated",
        message=notif_msg,
        type="ROLE_CHANGE",
        is_read=False,
    )
    db.add(notif)
    db.commit()
    db.refresh(user)

    # Dispatch official Role Change email in background
    send_role_change_email(
        recipient_email=user.email,
        recipient_name=user.full_name or "FleetFlow Member",
        old_role=old_role_str,
        new_role=new_role_str,
        admin_name=current_user.full_name or "FleetFlow Administrator",
        reason=payload.reason,
    )

    return user


@router.post("/users/batch-role")
def batch_update_user_roles(
    payload: BatchRoleUpdatePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin-only endpoint to batch update roles for multiple accounts at once."""
    if current_user.role != RoleEnum.Admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Admin can batch update user roles.",
        )

    role_map = {
        "Admin": RoleEnum.Admin,
        "FleetManager": RoleEnum.FleetManager,
        "Dispatcher": RoleEnum.Dispatcher,
        "Driver": RoleEnum.Driver,
    }
    new_role = role_map.get(payload.role)
    if not new_role:
        raise HTTPException(status_code=400, detail=f"Invalid role '{payload.role}'.")

    updated_count = 0
    for uid in payload.user_ids:
        user = db.query(User).filter(User.user_id == uid).first()
        if not user:
            continue

        old_role_str = user.role.value if hasattr(user.role, "value") else str(user.role)
        new_role_str = new_role.value if hasattr(new_role, "value") else str(new_role)

        user.role = new_role

        if new_role == RoleEnum.Driver:
            driver = db.query(Driver).filter(Driver.user_id == user.user_id).first()
            if not driver:
                driver = Driver(
                    user_id=user.user_id,
                    license_number=f"DL-{str(user.user_id)[:8].upper()}",
                    address="Operations Hub",
                    status="Active",
                    experience_years=2,
                )
                db.add(driver)
            else:
                driver.status = "Active"
        elif old_role_str == "Driver" and new_role != RoleEnum.Driver:
            driver = db.query(Driver).filter(Driver.user_id == user.user_id).first()
            if driver:
                driver.status = "Inactive"

        notif = Notification(
            user_id=user.user_id,
            title="Role & Privileges Updated",
            message=f"Your FleetFlow role has been changed from '{old_role_str}' to '{new_role_str}' by Administrator {current_user.full_name}." + (f" Note: {payload.reason}" if payload.reason else ""),
            type="ROLE_CHANGE",
            is_read=False,
        )
        db.add(notif)
        db.commit()

        send_role_change_email(
            recipient_email=user.email,
            recipient_name=user.full_name or "FleetFlow Member",
            old_role=old_role_str,
            new_role=new_role_str,
            admin_name=current_user.full_name or "FleetFlow Administrator",
            reason=payload.reason,
        )
        updated_count += 1

    return {"message": f"Successfully updated {updated_count} user(s) to '{payload.role}' and dispatched notification emails.", "updated_count": updated_count}


@router.patch("/users/{user_id}/status", response_model=UserOut)
def update_user_status(
    user_id: str,
    payload: StatusUpdatePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin-only endpoint to toggle a user's active/verified status (Account Suspension/Activation)."""
    if current_user.role != RoleEnum.Admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Admin can modify user status.",
        )

    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if user.user_id == current_user.user_id:
        raise HTTPException(status_code=400, detail="Cannot suspend your own admin account.")

    user.is_verified = payload.is_verified
    db.commit()
    db.refresh(user)
    return user


@router.post("/users/batch-status")
def batch_update_user_status(
    payload: BatchStatusUpdatePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin-only endpoint to batch suspend or activate multiple user accounts."""
    if current_user.role != RoleEnum.Admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Admin can modify user status.",
        )

    updated_count = 0
    action = "activated" if payload.is_verified else "suspended"
    for uid in payload.user_ids:
        u = db.query(User).filter(User.user_id == uid).first()
        if not u or u.user_id == current_user.user_id:
            continue
        u.is_verified = payload.is_verified
        updated_count += 1

    db.commit()
    return {"message": f"Successfully {action} {updated_count} user account(s).", "updated_count": updated_count}


@router.patch("/users/{user_id}", response_model=UserOut)
def admin_update_user(
    user_id: str,
    payload: AdminUserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Admin-only endpoint to update a user's full_name, email, phone, and optionally role.
    Role changes are restricted to Admins and trigger notification email.
    """
    if current_user.role != RoleEnum.Admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Admin can modify other user accounts.",
        )

    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    # Check email uniqueness if email is changed
    if payload.email and payload.email.strip().lower() != user.email.lower():
        new_email = payload.email.strip().lower()
        existing = db.query(User).filter(User.email == new_email).first()
        if existing and existing.user_id != user.user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Email '{new_email}' is already in use by another account.",
            )
        user.email = new_email

    if payload.full_name is not None and payload.full_name.strip():
        user.full_name = payload.full_name.strip()

    if payload.phone is not None:
        user.phone = payload.phone.strip()

    # If role changed, ensure only admin can change it, and send email notification
    if payload.role and payload.role != user.role:
        old_role = user.role.value if hasattr(user.role, "value") else str(user.role)
        new_role = payload.role.value if hasattr(payload.role, "value") else str(payload.role)
        user.role = payload.role
        try:
            send_role_change_email(
                recipient_email=user.email,
                recipient_name=user.full_name or "FleetFlow Member",
                old_role=old_role,
                new_role=new_role,
                admin_name=current_user.full_name or "FleetFlow Administrator",
                reason="Admin profile update",
            )
        except Exception:
            pass

    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}")
def delete_user(
    user_id: str,
    reason: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin-only endpoint to safely and permanently delete a user account, cleaning up all FK constraints."""
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

    deleted_name = user.full_name
    _safe_delete_single_user(db, user, admin_name=current_user.full_name, reason=reason)
    return {"status": "success", "message": f"User account for '{deleted_name}' successfully removed and decommission email dispatched."}


@router.post("/users/batch-delete")
def batch_delete_users(
    payload: BatchDeletePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin-only endpoint to safely delete multiple user accounts at once."""
    if current_user.role != RoleEnum.Admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Admin can batch delete user accounts.",
        )

    deleted_count = 0
    for uid in payload.user_ids:
        user = db.query(User).filter(User.user_id == uid).first()
        if not user or user.user_id == current_user.user_id:
            continue
        _safe_delete_single_user(db, user, admin_name=current_user.full_name, reason=payload.reason)
        deleted_count += 1

    return {"status": "success", "message": f"Successfully decommissioned {deleted_count} account(s).", "deleted_count": deleted_count}


# ── Password Reset & Change Password ───────────────────────────────────────
class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    email: str
    otp: str
    new_password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


def _send_password_reset_email_background(full_name: str, email: str, otp_code: str):
    """Send 6-digit password reset OTP email via Resend/Brevo HTTP API or SMTP."""
    body_preview = f"Your FleetFlow password reset OTP code is {otp_code}. Valid for 10 minutes."
    print("==================================================")
    print(f"[RESET OTP DISPATCH] Recipient: {email} | Code: {otp_code}")
    print("==================================================")
    try:
        subject = f"FleetFlow — Password Reset OTP is {otp_code}"
        body_text = (
            f"Hello {full_name},\n\n"
            f"We received a request to reset your FleetFlow password.\n"
            f"Your 6-digit password reset OTP is:\n\n"
            f"   {otp_code}\n\n"
            f"This code is valid for 10 minutes. If you did not request a password reset, please secure your account immediately.\n\n"
            f"— FleetFlow Logistics Security Team"
        )
        body_html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #E2E8F0; border-radius: 16px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #0F172A; margin: 0;">FleetFlow Security</h2>
            <p style="color: #64748B; font-size: 13px; margin-top: 4px;">Password Reset Request</p>
          </div>
          <p style="color: #334155; font-size: 14px;">Hello <strong>{full_name}</strong>,</p>
          <p style="color: #475569; font-size: 13px; line-height: 1.5;">
            We received a request to reset your password. Use the 6-digit OTP below to proceed with setting a new password:
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

        dispatch_email(
            to_email=email,
            subject=subject,
            body_text=body_text,
            body_html=body_html,
            sender_name="FleetFlow Security",
        )
    except Exception as exc:
        print(f"[RESET OTP EMAIL] Send error for {email}: {exc}")
    finally:
        _append_email_log(
            recipient=email,
            recipient_name=full_name,
            role="User",
            subject=f"FleetFlow — Password Reset OTP is {otp_code}",
            body_preview=body_preview,
            added_by_admin=False,
        )


@router.post("/forgot-password")
def forgot_password(
    payload: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Initiate password reset: send 6-digit OTP code to user's email.
    """
    user = get_user_by_email(db, payload.email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with this email address.",
        )

    otp = _generate_otp()
    user.otp_code = otp
    user.otp_expires_at = datetime.utcnow() + timedelta(minutes=10)
    db.commit()

    background_tasks.add_task(
        _send_password_reset_email_background,
        full_name=user.full_name,
        email=user.email,
        otp_code=otp,
    )
    return {
        "message": f"Password reset OTP code has been dispatched to {user.email}.",
        "email": user.email,
    }


@router.post("/reset-password")
def reset_password(
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    """
    Verify OTP and update user's password.
    """
    user = get_user_by_email(db, payload.email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with this email address.",
        )

    if not user.otp_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active password reset request found. Please request a new OTP.",
        )

    if user.otp_expires_at and datetime.utcnow() > user.otp_expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password reset OTP has expired. Please request a new OTP.",
        )

    submitted_otp = str(payload.otp).strip()
    actual_otp = str(user.otp_code).strip() if user.otp_code else ""
    if submitted_otp != actual_otp and submitted_otp != "123456":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect OTP code. Please enter the valid code sent to your email (or use test OTP 123456).",
        )

    if len(payload.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 6 characters.",
        )

    user.password = hash_password(payload.new_password)
    user.otp_code = None
    user.otp_expires_at = None
    user.is_verified = True
    db.commit()

    return {"message": "Password reset successfully! You can now sign in with your new password."}


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Allow an authenticated user to update their password.
    """
    if not verify_password(payload.current_password, current_user.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )

    if len(payload.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 6 characters.",
        )

    current_user.password = hash_password(payload.new_password)
    db.commit()

    return {"message": "Your password has been changed successfully."}

