"""
Attendance & Leave Management Router
Handles driver daily attendance tracking, bulk rosters, self check-ins,
leave applications, and Admin/FleetManager approval workflows.
"""
from datetime import date as dt_date, datetime, timedelta
from typing import List, Optional, Dict, Any
from uuid import UUID
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc
from pydantic import BaseModel, ConfigDict

from app.database import get_db
from app.core.deps import get_current_user
from app.models.user import User, RoleEnum
from app.models.driver import Driver
from app.models.attendance import Attendance
from app.models.leave_request import LeaveRequest

router = APIRouter()


# ── Pydantic Schemas ─────────────────────────────────────────────────────────
class AttendanceMarkRequest(BaseModel):
    driver_id: UUID
    date: Optional[dt_date] = None
    status: str  # "Present" | "Leave" | "Absent"
    remarks: Optional[str] = None


class AttendanceBulkItem(BaseModel):
    driver_id: UUID
    status: str
    date: Optional[dt_date] = None
    remarks: Optional[str] = None


class AttendanceBulkMarkRequest(BaseModel):
    records: List[AttendanceBulkItem]


class AttendanceOut(BaseModel):
    attendance_id: UUID
    driver_id: UUID
    driver_name: str
    license_number: Optional[str] = None
    duty_status: Optional[str] = "Active"
    date: dt_date
    status: str
    remarks: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class DailyRosterResponse(BaseModel):
    target_date: str
    total_drivers: int
    present_count: int
    leave_count: int
    absent_count: int
    unmarked_count: int
    roster: List[AttendanceOut]


class DriverAttendanceSummary(BaseModel):
    driver_id: UUID
    driver_name: str
    license_number: Optional[str] = None
    total_records: int
    present_days: int
    leave_days: int
    absent_days: int
    attendance_rate_pct: float
    current_month_present: int
    current_month_working_days: int
    records: List[AttendanceOut]


class LeaveApplyRequest(BaseModel):
    driver_id: Optional[UUID] = None
    start_date: dt_date
    end_date: dt_date
    leave_type: str = "Casual"  # Casual, Sick, Medical, Emergency, Vacation
    reason: Optional[str] = None


class LeaveReviewRequest(BaseModel):
    status: str  # "Approved" | "Rejected"
    manager_remarks: Optional[str] = None


class LeaveOut(BaseModel):
    leave_id: UUID
    driver_id: UUID
    driver_name: str
    license_number: Optional[str] = None
    start_date: dt_date
    end_date: dt_date
    leave_type: str
    reason: Optional[str] = None
    status: str
    reviewed_by: Optional[UUID] = None
    reviewed_at: Optional[datetime] = None
    manager_remarks: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Helper to resolve driver record for user ────────────────────────────────
def _get_driver_for_user(db: Session, user: User) -> Driver:
    d = db.query(Driver).filter(Driver.user_id == user.user_id).first()
    if not d:
        # Auto-create fallback driver profile for driver user if not existing
        d = Driver(
            user_id=user.user_id,
            license_number=f"CDL-{str(user.user_id)[:8].upper()}",
            status="Active",
            experience_years=1,
            address="Main Depot",
        )
        db.add(d)
        db.commit()
        db.refresh(d)
    return d


# ── 1. Mark Attendance (Single Driver) ───────────────────────────────────────
@router.post("/mark", response_model=AttendanceOut)
def mark_attendance(
    payload: AttendanceMarkRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Mark or update attendance for a driver on a specific date.
    Admin & FleetManager only.
    """
    if current_user.role not in (RoleEnum.Admin, RoleEnum.FleetManager):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Admins and Fleet Managers can mark driver attendance.",
        )

    target_date = payload.date or dt_date.today()
    valid_statuses = ("Present", "Leave", "Absent")
    normalized_status = payload.status.title()
    if normalized_status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Status must be one of {valid_statuses}.",
        )

    driver = db.query(Driver).filter(Driver.driver_id == payload.driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver record not found.")

    # Upsert attendance record
    att = db.query(Attendance).filter(
        Attendance.driver_id == payload.driver_id,
        Attendance.date == target_date,
    ).first()

    if att:
        att.status = normalized_status
        if payload.remarks is not None:
            att.remarks = payload.remarks
    else:
        att = Attendance(
            attendance_id=uuid.uuid4(),
            driver_id=payload.driver_id,
            date=target_date,
            status=normalized_status,
            remarks=payload.remarks or f"Marked by {current_user.full_name}",
        )
        db.add(att)

    db.commit()
    db.refresh(att)

    user = db.query(User).filter(User.user_id == driver.user_id).first() if driver.user_id else None
    driver_name = user.full_name if user else "Driver"

    return AttendanceOut(
        attendance_id=att.attendance_id,
        driver_id=driver.driver_id,
        driver_name=driver_name,
        license_number=driver.license_number,
        duty_status=driver.status or "Active",
        date=att.date,
        status=att.status,
        remarks=att.remarks,
    )


# ── 2. Bulk Mark Attendance ──────────────────────────────────────────────────
@router.post("/bulk")
def bulk_mark_attendance(
    payload: AttendanceBulkMarkRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Bulk update attendance for multiple drivers on given dates.
    Admin & FleetManager only.
    """
    if current_user.role not in (RoleEnum.Admin, RoleEnum.FleetManager):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Admins and Fleet Managers can bulk-mark attendance.",
        )

    updated_count = 0
    for item in payload.records:
        target_date = item.date or dt_date.today()
        normalized_status = item.status.title()
        if normalized_status not in ("Present", "Leave", "Absent"):
            continue

        att = db.query(Attendance).filter(
            Attendance.driver_id == item.driver_id,
            Attendance.date == target_date,
        ).first()

        if att:
            att.status = normalized_status
            if item.remarks is not None:
                att.remarks = item.remarks
        else:
            att = Attendance(
                attendance_id=uuid.uuid4(),
                driver_id=item.driver_id,
                date=target_date,
                status=normalized_status,
                remarks=item.remarks or f"Bulk marked by {current_user.full_name}",
            )
            db.add(att)
        updated_count += 1

    db.commit()
    return {"message": f"Successfully updated attendance for {updated_count} records.", "count": updated_count}


# ── 3. Mark All Unmarked Drivers as Present ─────────────────────────────────
@router.post("/mark-all-present")
def mark_all_present(
    target_date: Optional[dt_date] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Quick action: Mark all active drivers with no attendance record on target_date as Present.
    Admin & FleetManager only.
    """
    if current_user.role not in (RoleEnum.Admin, RoleEnum.FleetManager):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Admins and Fleet Managers can mark all drivers present.",
        )

    t_date = target_date or dt_date.today()
    drivers = db.query(Driver).all()
    marked_count = 0

    for d in drivers:
        existing = db.query(Attendance).filter(
            Attendance.driver_id == d.driver_id,
            Attendance.date == t_date,
        ).first()

        if not existing:
            att = Attendance(
                attendance_id=uuid.uuid4(),
                driver_id=d.driver_id,
                date=t_date,
                status="Present",
                remarks="Auto-marked Present via Bulk Roster",
            )
            db.add(att)
            marked_count += 1

    db.commit()
    return {"message": f"Marked {marked_count} drivers as Present for {t_date}.", "marked_count": marked_count}


# ── 4. Get Fleet-Wide Daily Roster / Attendance List ─────────────────────────
@router.get("/", response_model=DailyRosterResponse)
def get_attendance_roster(
    target_date: Optional[dt_date] = Query(None),
    status_filter: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Fleet-wide attendance for a given date.
    - Admin & FleetManager: Full roster + marking actions.
    - Dispatcher: Read-only availability view (useful to see who's available for trips).
    - Driver: Automatically scoped to own attendance.
    """
    t_date = target_date or dt_date.today()

    if current_user.role == RoleEnum.Driver:
        my_driver = _get_driver_for_user(db, current_user)
        drivers = [my_driver]
    else:
        drivers = db.query(Driver).all()

    total_drivers = len(drivers)
    attendance_records = db.query(Attendance).filter(Attendance.date == t_date).all()
    att_by_driver = {str(a.driver_id): a for a in attendance_records}

    present_count = 0
    leave_count = 0
    absent_count = 0
    unmarked_count = 0

    roster: List[AttendanceOut] = []

    for d in drivers:
        user = db.query(User).filter(User.user_id == d.user_id).first() if d.user_id else None
        driver_name = user.full_name if user else "Driver"

        att = att_by_driver.get(str(d.driver_id))
        att_status = att.status if att else "Unmarked"
        att_remarks = att.remarks if att else None
        att_id = att.attendance_id if att else uuid.uuid4()

        if att_status == "Present":
            present_count += 1
        elif att_status == "Leave":
            leave_count += 1
        elif att_status == "Absent":
            absent_count += 1
        else:
            unmarked_count += 1

        if status_filter and status_filter.lower() != "all" and att_status.lower() != status_filter.lower():
            continue

        roster.append(
            AttendanceOut(
                attendance_id=att_id,
                driver_id=d.driver_id,
                driver_name=driver_name,
                license_number=d.license_number,
                duty_status=d.status or "Active",
                date=t_date,
                status=att_status,
                remarks=att_remarks,
            )
        )

    return DailyRosterResponse(
        target_date=str(t_date),
        total_drivers=total_drivers,
        present_count=present_count,
        leave_count=leave_count,
        absent_count=absent_count,
        unmarked_count=unmarked_count,
        roster=roster,
    )


# ── 5. Driver Attendance History & Aggregated Summary ───────────────────────
@router.get("/driver/{driver_id}", response_model=DriverAttendanceSummary)
def get_driver_attendance_history(
    driver_id: UUID,
    start_date: Optional[dt_date] = Query(None),
    end_date: Optional[dt_date] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get detailed attendance history and statistics for a specific driver.
    - Admin, FleetManager, Dispatcher: Can view any driver's history.
    - Driver: Can only view their own history.
    """
    driver = db.query(Driver).filter(Driver.driver_id == driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found.")

    if current_user.role == RoleEnum.Driver and driver.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="You can only view your own attendance history.")

    user = db.query(User).filter(User.user_id == driver.user_id).first() if driver.user_id else None
    driver_name = user.full_name if user else "Driver"

    query = db.query(Attendance).filter(Attendance.driver_id == driver_id)
    if start_date:
        query = query.filter(Attendance.date >= start_date)
    if end_date:
        query = query.filter(Attendance.date <= end_date)

    records = query.order_by(Attendance.date.desc()).all()

    present_days = len([r for r in records if r.status == "Present"])
    leave_days = len([r for r in records if r.status == "Leave"])
    absent_days = len([r for r in records if r.status == "Absent"])
    total_recorded = len(records)

    rate = round((present_days / max(total_recorded, 1)) * 100, 1) if total_recorded > 0 else 100.0

    # Current month metrics
    today = dt_date.today()
    first_of_month = dt_date(today.year, today.month, 1)
    month_records = db.query(Attendance).filter(
        Attendance.driver_id == driver_id,
        Attendance.date >= first_of_month,
        Attendance.date <= today,
    ).all()
    cur_month_present = len([r for r in month_records if r.status == "Present"])
    cur_month_working = max(len(month_records), 22)

    roster_items = [
        AttendanceOut(
            attendance_id=r.attendance_id,
            driver_id=driver.driver_id,
            driver_name=driver_name,
            license_number=driver.license_number,
            duty_status=driver.status or "Active",
            date=r.date,
            status=r.status,
            remarks=r.remarks,
        )
        for r in records
    ]

    return DriverAttendanceSummary(
        driver_id=driver.driver_id,
        driver_name=driver_name,
        license_number=driver.license_number,
        total_records=total_recorded,
        present_days=present_days,
        leave_days=leave_days,
        absent_days=absent_days,
        attendance_rate_pct=rate,
        current_month_present=cur_month_present,
        current_month_working_days=cur_month_working,
        records=roster_items,
    )


# ── 6. Driver My-History (Self) ──────────────────────────────────────────────
@router.get("/my-history", response_model=DriverAttendanceSummary)
def get_my_attendance_history(
    start_date: Optional[dt_date] = Query(None),
    end_date: Optional[dt_date] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Convenience endpoint for logged-in Driver to view their own attendance history.
    """
    driver = _get_driver_for_user(db, current_user)
    return get_driver_attendance_history(
        driver_id=driver.driver_id,
        start_date=start_date,
        end_date=end_date,
        db=db,
        current_user=current_user,
    )


# ── 7. Driver Self Check-In ─────────────────────────────────────────────────
@router.post("/check-in", response_model=AttendanceOut)
def driver_check_in(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Driver self check-in for today. Marks attendance as Present.
    """
    driver = _get_driver_for_user(db, current_user)
    today = dt_date.today()

    att = db.query(Attendance).filter(
        Attendance.driver_id == driver.driver_id,
        Attendance.date == today,
    ).first()

    now_time = datetime.utcnow().strftime("%H:%M UTC")
    if att:
        att.status = "Present"
        att.remarks = f"Self Check-in at {now_time}"
    else:
        att = Attendance(
            attendance_id=uuid.uuid4(),
            driver_id=driver.driver_id,
            date=today,
            status="Present",
            remarks=f"Self Check-in at {now_time}",
        )
        db.add(att)

    driver.status = "Active"
    db.commit()
    db.refresh(att)

    return AttendanceOut(
        attendance_id=att.attendance_id,
        driver_id=driver.driver_id,
        driver_name=current_user.full_name,
        license_number=driver.license_number,
        duty_status=driver.status,
        date=att.date,
        status=att.status,
        remarks=att.remarks,
    )


# ── 8. Apply for Leave (Driver) ─────────────────────────────────────────────
@router.post("/leaves/apply", response_model=LeaveOut, status_code=status.HTTP_201_CREATED)
def apply_leave(
    payload: LeaveApplyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Submit a leave request. Drivers apply for themselves; Admins/FMs can apply on behalf of any driver.
    """
    if current_user.role == RoleEnum.Driver:
        driver = _get_driver_for_user(db, current_user)
    else:
        if not payload.driver_id:
            raise HTTPException(status_code=400, detail="driver_id is required when applying on behalf of a driver.")
        driver = db.query(Driver).filter(Driver.driver_id == payload.driver_id).first()
        if not driver:
            raise HTTPException(status_code=404, detail="Driver not found.")

    if payload.end_date < payload.start_date:
        raise HTTPException(status_code=400, detail="End date cannot be earlier than start date.")

    leave = LeaveRequest(
        leave_id=uuid.uuid4(),
        driver_id=driver.driver_id,
        start_date=payload.start_date,
        end_date=payload.end_date,
        leave_type=payload.leave_type or "Casual",
        reason=payload.reason,
        status="Pending",
    )
    db.add(leave)
    db.commit()
    db.refresh(leave)

    user = db.query(User).filter(User.user_id == driver.user_id).first() if driver.user_id else None
    driver_name = user.full_name if user else "Driver"

    return LeaveOut(
        leave_id=leave.leave_id,
        driver_id=driver.driver_id,
        driver_name=driver_name,
        license_number=driver.license_number,
        start_date=leave.start_date,
        end_date=leave.end_date,
        leave_type=leave.leave_type,
        reason=leave.reason,
        status=leave.status,
        reviewed_by=leave.reviewed_by,
        reviewed_at=leave.reviewed_at,
        manager_remarks=leave.manager_remarks,
        created_at=leave.created_at,
    )


# ── 9. List Leave Requests ───────────────────────────────────────────────────
@router.get("/leaves", response_model=List[LeaveOut])
def list_leaves(
    status_filter: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List leave requests.
    - Admin, FleetManager, Dispatcher: View all driver leaves.
    - Driver: View only own leave applications.
    """
    query = db.query(LeaveRequest)

    if current_user.role == RoleEnum.Driver:
        my_driver = _get_driver_for_user(db, current_user)
        query = query.filter(LeaveRequest.driver_id == my_driver.driver_id)

    if status_filter and status_filter.lower() != "all":
        query = query.filter(LeaveRequest.status.ilike(status_filter))

    leaves = query.order_by(LeaveRequest.created_at.desc()).all()
    result = []

    for l in leaves:
        drv = db.query(Driver).filter(Driver.driver_id == l.driver_id).first()
        user = db.query(User).filter(User.user_id == drv.user_id).first() if drv and drv.user_id else None
        driver_name = user.full_name if user else "Driver"

        result.append(
            LeaveOut(
                leave_id=l.leave_id,
                driver_id=l.driver_id,
                driver_name=driver_name,
                license_number=drv.license_number if drv else None,
                start_date=l.start_date,
                end_date=l.end_date,
                leave_type=l.leave_type,
                reason=l.reason,
                status=l.status,
                reviewed_by=l.reviewed_by,
                reviewed_at=l.reviewed_at,
                manager_remarks=l.manager_remarks,
                created_at=l.created_at,
            )
        )

    return result


# ── 10. Review Leave Request (Approve / Reject + Auto-Attendance Sync) ───────
@router.patch("/leaves/{leave_id}/review", response_model=LeaveOut)
def review_leave(
    leave_id: UUID,
    payload: LeaveReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Approve or reject a leave request. Admin & FleetManager only.
    On approval: automatically marks the driver's attendance as 'Leave' for all dates in the range.
    """
    if current_user.role not in (RoleEnum.Admin, RoleEnum.FleetManager):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Admins and Fleet Managers can review leave requests.",
        )

    normalized_status = payload.status.title()
    if normalized_status not in ("Approved", "Rejected"):
        raise HTTPException(status_code=400, detail="Status must be 'Approved' or 'Rejected'.")

    leave = db.query(LeaveRequest).filter(LeaveRequest.leave_id == leave_id).first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found.")

    leave.status = normalized_status
    leave.reviewed_by = current_user.user_id
    leave.reviewed_at = datetime.utcnow()
    leave.manager_remarks = payload.manager_remarks

    # If Approved, auto-sync Attendance records across start_date to end_date
    if normalized_status == "Approved":
        curr_d = leave.start_date
        while curr_d <= leave.end_date:
            att = db.query(Attendance).filter(
                Attendance.driver_id == leave.driver_id,
                Attendance.date == curr_d,
            ).first()

            remark_msg = f"Approved Leave ({leave.leave_type}): {leave.reason or 'Personal'}"
            if att:
                att.status = "Leave"
                att.remarks = remark_msg
            else:
                att = Attendance(
                    attendance_id=uuid.uuid4(),
                    driver_id=leave.driver_id,
                    date=curr_d,
                    status="Leave",
                    remarks=remark_msg,
                )
                db.add(att)
            curr_d += timedelta(days=1)

    db.commit()
    db.refresh(leave)

    drv = db.query(Driver).filter(Driver.driver_id == leave.driver_id).first()
    user = db.query(User).filter(User.user_id == drv.user_id).first() if drv and drv.user_id else None
    driver_name = user.full_name if user else "Driver"

    return LeaveOut(
        leave_id=leave.leave_id,
        driver_id=leave.driver_id,
        driver_name=driver_name,
        license_number=drv.license_number if drv else None,
        start_date=leave.start_date,
        end_date=leave.end_date,
        leave_type=leave.leave_type,
        reason=leave.reason,
        status=leave.status,
        reviewed_by=leave.reviewed_by,
        reviewed_at=leave.reviewed_at,
        manager_remarks=leave.manager_remarks,
        created_at=leave.created_at,
    )


# ── 11. Delete / Cancel Leave Request ────────────────────────────────────────
@router.delete("/leaves/{leave_id}", status_code=status.HTTP_204_NO_CONTENT)
def cancel_leave(
    leave_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Cancel a pending leave request. Drivers can cancel their own; Admins can cancel any.
    """
    leave = db.query(LeaveRequest).filter(LeaveRequest.leave_id == leave_id).first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found.")

    if current_user.role == RoleEnum.Driver:
        my_driver = _get_driver_for_user(db, current_user)
        if leave.driver_id != my_driver.driver_id:
            raise HTTPException(status_code=403, detail="Cannot cancel another driver's leave request.")
        if leave.status != "Pending":
            raise HTTPException(status_code=400, detail="Cannot cancel a leave request that has already been reviewed.")

    db.delete(leave)
    db.commit()
    return None
