from datetime import date
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db, require_roles
from app.crud import attendance as attendance_crud
from app.crud.driver import get_driver_by_user_id
from app.models.driver import Driver
from app.models.user import User
from app.schemas.attendance import AttendanceCreate, AttendanceRead, AttendanceSummary

router = APIRouter(tags=["attendance"])


def verify_driver_access(driver_id: UUID, current_user: User, db: Session):
    """
    Verifies that the current_user is allowed to access data for driver_id.
    - Admin & FleetManager can access any driver.
    - Driver can only access their own driver_id or user_id.
    """
    if current_user.role in ["Admin", "FleetManager"]:
        return

    if current_user.role == "Driver":
        driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
        is_owner = (
            (driver and driver.driver_id == driver_id)
            or current_user.user_id == driver_id
        )
        if not is_owner:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: Drivers can only view their own attendance records.",
            )
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Access forbidden: Insufficient permissions.",
    )


@router.post("/me/check-in", response_model=AttendanceRead)
def driver_self_check_in(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AttendanceRead:
    """Driver self check-in endpoint using authenticated JWT token."""
    if current_user.role != "Driver":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only drivers can perform self check-in.",
        )
    driver = get_driver_by_user_id(db, current_user.user_id, auto_create=True)
    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver profile not found.",
        )
    return attendance_crud.driver_check_in(db, driver.driver_id)


@router.post("/me/check-out", response_model=AttendanceRead)
def driver_self_check_out(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AttendanceRead:
    """Driver self check-out endpoint using authenticated JWT token."""
    if current_user.role != "Driver":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only drivers can perform self check-out.",
        )
    driver = get_driver_by_user_id(db, current_user.user_id, auto_create=True)
    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver profile not found.",
        )
    return attendance_crud.driver_check_out(db, driver.driver_id)


@router.get("/me/today", response_model=AttendanceRead | None)
def get_my_today_attendance(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AttendanceRead | None:
    """Fetch today's attendance record for current driver."""
    if current_user.role != "Driver":
        return None
    driver = get_driver_by_user_id(db, current_user.user_id, auto_create=True)
    if not driver:
        return None
    records = attendance_crud.get_driver_attendance_history(
        db=db,
        driver_id=driver.driver_id,
        start_date=date.today(),
        end_date=date.today(),
        limit=1,
    )
    return records[0] if records else None


@router.get("/me/summary", response_model=AttendanceSummary)
def get_my_attendance_summary(
    month: int | None = Query(None, ge=1, le=12, description="Month (1-12)"),
    year: int | None = Query(None, ge=2020, le=2100, description="Year (e.g. 2026)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AttendanceSummary:
    """
    Get attendance summary for currently authenticated driver.
    - Resolves driver_id from current_user session token automatically.
    - Requires Driver role.
    """
    if current_user.role != "Driver":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only drivers can view personal driver attendance summary.",
        )
    driver = get_driver_by_user_id(db, current_user.user_id, auto_create=True)
    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver profile not found.",
        )

    return attendance_crud.get_driver_attendance_summary(
        db=db,
        driver_id=driver.driver_id,
        month=month,
        year=year,
    )


@router.get("/me", response_model=list[AttendanceRead])
def get_my_attendance_history(
    date_val: date | None = Query(None, alias="date", description="Specific date filter (YYYY-MM-DD)"),
    start_date: date | None = Query(None, description="Start date filter (YYYY-MM-DD)"),
    end_date: date | None = Query(None, description="End date filter (YYYY-MM-DD)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[AttendanceRead]:
    """
    Get attendance history records for currently authenticated driver.
    - Resolves driver_id from current_user session token automatically.
    - Supports filtering by specific date (?date=YYYY-MM-DD).
    - Requires Driver role.
    """
    if current_user.role != "Driver":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only drivers can view personal driver attendance history.",
        )
    driver = get_driver_by_user_id(db, current_user.user_id, auto_create=True)
    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver profile not found.",
        )

    filter_start = date_val or start_date
    filter_end = date_val or end_date

    return attendance_crud.get_driver_attendance_history(
        db=db,
        driver_id=driver.driver_id,
        start_date=filter_start,
        end_date=filter_end,
        skip=skip,
        limit=limit,
    )


@router.post(
    "/me",
    response_model=AttendanceRead,
    status_code=status.HTTP_201_CREATED,
)
def mark_my_attendance(
    status_val: str = Query("Present", description="Attendance status (Present, On Time)"),
    remarks: str | None = Query(None, description="Optional remarks"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AttendanceRead:
    """
    Allows currently authenticated driver to mark their attendance for today.
    """
    if current_user.role != "Driver":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only drivers can mark personal attendance.",
        )
    driver = get_driver_by_user_id(db, current_user.user_id, auto_create=True)
    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver profile not found.",
        )

    today = date.today()
    attendance_in = AttendanceCreate(
        driver_id=driver.driver_id,
        date=today,
        status=status_val,
        remarks=remarks or "Self check-in via FleetFlow",
    )

    record = attendance_crud.upsert_attendance(db, attendance_in)
    return attendance_crud.build_attendance_read(record)


@router.post(
    "/",
    response_model=AttendanceRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("Admin", "FleetManager"))],
)
def mark_driver_attendance(
    attendance_in: AttendanceCreate,
    db: Session = Depends(get_db),
) -> AttendanceRead:
    """
    Mark or update attendance for a driver on a specific date (upsert behavior).
    Restricted to Admin and FleetManager.
    """
    # Verify driver exists
    driver = db.query(Driver).filter(
        (Driver.driver_id == attendance_in.driver_id) | (Driver.user_id == attendance_in.driver_id)
    ).first()
    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Driver with ID {attendance_in.driver_id} not found.",
        )

    # Normalize to Driver.driver_id
    attendance_in.driver_id = driver.driver_id

    record = attendance_crud.upsert_attendance(db, attendance_in)
    return attendance_crud.build_attendance_read(record)


@router.get(
    "/",
    response_model=list[AttendanceRead],
    dependencies=[Depends(require_roles("Admin", "FleetManager", "Dispatcher"))],
)
def list_fleet_attendance(
    start_date: date | None = Query(None, description="Start date filter (YYYY-MM-DD)"),
    end_date: date | None = Query(None, description="End date filter (YYYY-MM-DD)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
) -> list[AttendanceRead]:
    """
    Fetch fleet-wide attendance records.
    Allowed for Admin, FleetManager, and Dispatcher (read-only view).
    """
    return attendance_crud.get_fleet_attendance_list(
        db=db,
        start_date=start_date,
        end_date=end_date,
        skip=skip,
        limit=limit,
    )


@router.get("/driver/{driver_id}", response_model=list[AttendanceRead])
def get_driver_attendance_history_endpoint(
    driver_id: UUID,
    start_date: date | None = Query(None, description="Start date filter (YYYY-MM-DD)"),
    end_date: date | None = Query(None, description="End date filter (YYYY-MM-DD)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[AttendanceRead]:
    """
    Get attendance history for a single driver.
    - Admin & FleetManager can view any driver.
    - Drivers can only view their own attendance history (403 for other driver IDs).
    """
    # Resolve target driver_id if user_id was passed
    driver = db.query(Driver).filter(
        (Driver.driver_id == driver_id) | (Driver.user_id == driver_id)
    ).first()
    target_driver_id = driver.driver_id if driver else driver_id

    verify_driver_access(target_driver_id, current_user, db)

    return attendance_crud.get_driver_attendance_history(
        db=db,
        driver_id=target_driver_id,
        start_date=start_date,
        end_date=end_date,
        skip=skip,
        limit=limit,
    )


@router.get("/driver/{driver_id}/summary", response_model=AttendanceSummary)
def get_driver_attendance_summary_endpoint(
    driver_id: UUID,
    month: int | None = Query(None, ge=1, le=12, description="Month (1-12)"),
    year: int | None = Query(None, ge=2020, le=2100, description="Year (e.g. 2026)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AttendanceSummary:
    """
    Get attendance summary counts (Present, Leave, Absent) and attendance rate for a driver.
    - Admin & FleetManager can view summary for any driver.
    - Drivers can only view summary for their own profile.
    """
    driver = db.query(Driver).filter(
        (Driver.driver_id == driver_id) | (Driver.user_id == driver_id)
    ).first()
    target_driver_id = driver.driver_id if driver else driver_id

    verify_driver_access(target_driver_id, current_user, db)

    return attendance_crud.get_driver_attendance_summary(
        db=db,
        driver_id=target_driver_id,
        month=month,
        year=year,
    )
