from datetime import date, datetime, timezone
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import extract, func, or_

from app.models.attendance import Attendance
from app.models.driver import Driver
from app.models.user import User
from app.schemas.attendance import AttendanceCreate, AttendanceRead, AttendanceSummary


def upsert_attendance(db: Session, attendance_in: AttendanceCreate) -> Attendance:
    """
    Upsert attendance record for driver_id on date.
    Ensures one record per driver per date.
    """
    existing = (
        db.query(Attendance)
        .filter(
            Attendance.driver_id == attendance_in.driver_id,
            Attendance.date == attendance_in.date,
        )
        .first()
    )

    if existing:
        existing.status = attendance_in.status
        db.add(existing)
        db.commit()
        db.refresh(existing)
        return existing

    record = Attendance(
        driver_id=attendance_in.driver_id,
        date=attendance_in.date,
        status=attendance_in.status,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


from app.models.leave_request import LeaveRequest
from fastapi import HTTPException, status


def build_attendance_read(att: Attendance) -> AttendanceRead:
    driver = att.driver
    user = driver.user if driver and hasattr(driver, 'user') else None

    cin_str = att.check_in_time.strftime("%I:%M %p") if att.check_in_time else None
    cout_str = att.check_out_time.strftime("%I:%M %p") if att.check_out_time else None

    working_hours_str = None
    if att.check_in_time:
        end_t = att.check_out_time or datetime.now(timezone.utc)
        diff_seconds = int((end_t - att.check_in_time).total_seconds())
        if diff_seconds > 0:
            hrs = diff_seconds // 3600
            mins = (diff_seconds % 3600) // 60
            working_hours_str = f"{hrs:02d}h {mins:02d}m"
        else:
            working_hours_str = "00h 00m"

    return AttendanceRead(
        attendance_id=att.attendance_id,
        driver_id=att.driver_id,
        date=att.date,
        status=att.status,
        check_in_time=att.check_in_time,
        check_out_time=att.check_out_time,
        remarks=att.remarks,
        created_at=att.created_at,
        check_in=cin_str,
        check_out=cout_str,
        working_hours=working_hours_str,
        driver_name=user.full_name if user else None,
        driver_email=user.email if user else None,
        license_number=driver.license_number if driver else None,
    )


def driver_check_in(db: Session, driver_id: UUID) -> AttendanceRead:
    today_d = date.today()
    now_t = datetime.now(timezone.utc)

    # 1. Check if driver has an approved leave today
    approved_leave = (
        db.query(LeaveRequest)
        .filter(
            LeaveRequest.driver_id == driver_id,
            LeaveRequest.status == "Approved",
            LeaveRequest.start_date <= today_d,
            LeaveRequest.end_date >= today_d,
        )
        .first()
    )
    if approved_leave:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot check in: You have an approved leave ({approved_leave.leave_type}) for today.",
        )

    # 2. Check existing attendance
    att = (
        db.query(Attendance)
        .filter(Attendance.driver_id == driver_id, Attendance.date == today_d)
        .first()
    )

    if att and att.check_in_time:
        formatted_cin = att.check_in_time.strftime("%I:%M %p")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Already checked in today at {formatted_cin}.",
        )

    if not att:
        att = Attendance(
            driver_id=driver_id,
            date=today_d,
            status="Present",
            check_in_time=now_t,
        )
    else:
        att.status = "Present"
        att.check_in_time = now_t

    db.add(att)
    db.commit()
    db.refresh(att)
    return build_attendance_read(att)


def driver_check_out(db: Session, driver_id: UUID) -> AttendanceRead:
    today_d = date.today()
    now_t = datetime.now(timezone.utc)

    att = (
        db.query(Attendance)
        .filter(Attendance.driver_id == driver_id, Attendance.date == today_d)
        .first()
    )

    if not att or not att.check_in_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must check in before checking out.",
        )

    if att.check_out_time:
        formatted_cout = att.check_out_time.strftime("%I:%M %p")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Already checked out today at {formatted_cout}.",
        )

    att.check_out_time = now_t
    db.add(att)
    db.commit()
    db.refresh(att)
    return build_attendance_read(att)


def get_driver_attendance_history(
    db: Session,
    driver_id: UUID,
    start_date: date | None = None,
    end_date: date | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[AttendanceRead]:
    query = db.query(Attendance).filter(Attendance.driver_id == driver_id)

    if start_date:
        query = query.filter(Attendance.date >= start_date)
    if end_date:
        query = query.filter(Attendance.date <= end_date)

    records = query.order_by(Attendance.date.desc()).offset(skip).limit(limit).all()
    return [build_attendance_read(r) for r in records]


def get_fleet_attendance_list(
    db: Session,
    start_date: date | None = None,
    end_date: date | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[AttendanceRead]:
    query = db.query(Attendance)

    if start_date:
        query = query.filter(Attendance.date >= start_date)
    if end_date:
        query = query.filter(Attendance.date <= end_date)

    records = query.order_by(Attendance.date.desc()).offset(skip).limit(limit).all()
    return [build_attendance_read(r) for r in records]


def get_driver_attendance_summary(
    db: Session,
    driver_id: UUID,
    month: int | None = None,
    year: int | None = None,
) -> AttendanceSummary:
    now = datetime.now(timezone.utc)
    target_month = month or now.month
    target_year = year or now.year

    driver = db.query(Driver).filter(Driver.driver_id == driver_id).first()
    user = driver.user if driver and hasattr(driver, 'user') else None
    driver_name = user.full_name if user else None

    query = db.query(Attendance).filter(Attendance.driver_id == driver_id)
    if month is not None:
        query = query.filter(extract("month", Attendance.date) == month)
    if year is not None:
        query = query.filter(extract("year", Attendance.date) == year)

    records = query.all()

    total_days = len(records)
    present_days = sum(1 for r in records if r.status.lower() == "present")
    leave_days = sum(1 for r in records if r.status.lower() == "leave")
    absent_days = sum(1 for r in records if r.status.lower() == "absent")

    attendance_rate = round((present_days / total_days * 100.0), 1) if total_days > 0 else None

    return AttendanceSummary(
        driver_id=driver_id,
        driver_name=driver_name,
        month=target_month,
        year=target_year,
        total_days=total_days,
        present_days=present_days,
        leave_days=leave_days,
        absent_days=absent_days,
        attendance_rate_pct=attendance_rate,
    )
