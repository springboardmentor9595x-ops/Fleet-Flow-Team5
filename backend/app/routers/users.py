import logging
from datetime import datetime, timezone
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_db, require_admin
from app.models.driver import Driver
from app.models.user import User
from app.models.vehicle import Vehicle
from app.schemas.user import UserRead, UserRoleUpdate
from app.services.email import send_role_change_email

logger = logging.getLogger("fleetflow.users")

router = APIRouter(
    tags=["users"],
    dependencies=[Depends(require_admin)],
)


@router.get("/", response_model=list[UserRead])
def list_users(
    search: str | None = Query(None, description="Search by name or email"),
    role: str | None = Query(None, description="Filter by role (Admin, FleetManager, Dispatcher, Driver)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
) -> list[UserRead]:
    """Admin-only endpoint to list all registered users with optional filtering."""
    query = db.query(User)

    if role and role.strip() and role.strip().upper() != "ALL":
        query = query.filter(User.role == role.strip())

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            (User.full_name.ilike(term)) | (User.email.ilike(term)) | (User.phone.ilike(term))
        )

    users = query.order_by(User.created_at.desc()).offset(skip).limit(limit).all()
    return users


@router.get("/{user_id}", response_model=UserRead)
def get_user(
    user_id: UUID,
    db: Session = Depends(get_db),
) -> UserRead:
    """Admin-only endpoint to fetch a single user by ID."""
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found.",
        )
    return user


@router.patch("/{user_id}/role", response_model=UserRead)
def update_user_role(
    user_id: UUID,
    role_update: UserRoleUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
) -> UserRead:
    """
    Admin-only endpoint to change a user's role.
    Handles driver table synchronization, vehicle unassignment, and email notification.
    """
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found.",
        )

    old_role = user.role
    new_role = role_update.role

    if old_role == new_role:
        return user

    # Apply role change
    user.role = new_role

    # Role transition logic
    if new_role == "Driver":
        # Ensure a Driver profile exists for the user
        driver = db.query(Driver).filter(Driver.user_id == user_id).first()
        if not driver:
            driver = Driver(user_id=user_id, status="Active")
            db.add(driver)
    elif old_role == "Driver":
        # If user is no longer a driver, unassign from any vehicles and remove driver profile
        driver = db.query(Driver).filter(Driver.user_id == user_id).first()
        if driver:
            db.query(Vehicle).filter(Vehicle.assigned_driver == driver.driver_id).update(
                {"assigned_driver": None}
            )
            db.delete(driver)

    # Commit DB transaction FIRST before sending notifications
    db.commit()
    db.refresh(user)

    # In-App Notification to the affected user
    from app.crud.notification import notify_role_change
    notify_role_change(db, user, old_role, new_role)

    # Send role change email notification to the affected user's registered email
    try:
        admin_name = admin_user.full_name or "FleetFlow Administrator"
        change_time = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        send_role_change_email(
            to_email=user.email,
            user_name=user.full_name or "User",
            previous_role=old_role,
            new_role=new_role,
            changed_by_name=admin_name,
            change_date=change_time,
        )
    except Exception as e:
        logger.error(f"Failed to dispatch role change email notification to {user.email}: {e}")

    return user

