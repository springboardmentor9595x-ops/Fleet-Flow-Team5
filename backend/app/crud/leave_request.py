from datetime import date, datetime, timedelta, timezone
from uuid import UUID
from fastapi import HTTPException, status
from sqlalchemy import or_, and_
from sqlalchemy.orm import Session

from app.crud.attendance import upsert_attendance
from app.models.driver import Driver
from app.models.leave_request import LeaveRequest
from app.models.trip import Trip
from app.models.user import User
from app.schemas.attendance import AttendanceCreate
from app.schemas.leave_request import LeaveRequestCreate, LeaveRequestRead, LeaveRequestReview
from app.services.email import send_leave_approval_email, send_leave_rejection_email


def check_trip_conflict(db: Session, driver_id: UUID, start_d: date, end_d: date) -> str | None:
    """
    Checks if driver has scheduled or active trips overlapping [start_d, end_d].
    Returns conflict description if found, else None.
    """
    driver = db.query(Driver).filter(
        or_(Driver.driver_id == driver_id, Driver.user_id == driver_id)
    ).first()
    if not driver:
        return None

    # Find trips assigned to driver that are Scheduled or In Transit
    trips = (
        db.query(Trip)
        .filter(
            or_(Trip.driver_id == driver.driver_id, Trip.driver_id == driver.user_id),
            Trip.status.ilike("%scheduled%") | Trip.status.ilike("%in transit%"),
        )
        .all()
    )

    for t in trips:
        # Trip dates or created_at
        t_start = t.start_time.date() if t.start_time else (t.created_at.date() if t.created_at else None)
        t_end = t.end_time.date() if t.end_time else t_start

        if t_start:
            # Overlap check
            if t_start <= end_d and t_end >= start_d:
                trip_short = str(t.trip_id)[:8]
                route = f"{t.start_location or 'Origin'} -> {t.destination or 'Destination'}"
                return f"Driver has a conflicting active/scheduled trip (#{trip_short}: {route}) between {t_start} and {t_end}."

    return None


def create_leave_request(db: Session, driver_id: UUID, leave_in: LeaveRequestCreate) -> LeaveRequest:
    # 1. Date range check
    if leave_in.end_date < leave_in.start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End date cannot be before start date.",
        )

    # 2. Overlapping approved or pending leave check
    overlapping = (
        db.query(LeaveRequest)
        .filter(
            LeaveRequest.driver_id == driver_id,
            LeaveRequest.status.in_(["Pending", "Approved"]),
            LeaveRequest.start_date <= leave_in.end_date,
            LeaveRequest.end_date >= leave_in.start_date,
        )
        .first()
    )

    if overlapping:
        if overlapping.status == "Approved":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Driver already has an approved leave request ({overlapping.leave_type}) from {overlapping.start_date} to {overlapping.end_date}.",
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Driver already has a pending leave request ({overlapping.leave_type}) overlapping these dates.",
            )

    # 3. Scheduled trip conflict check
    conflict_msg = check_trip_conflict(db, driver_id, leave_in.start_date, leave_in.end_date)
    if conflict_msg:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot submit leave request. {conflict_msg}",
        )

    # Create request
    leave_req = LeaveRequest(
        driver_id=driver_id,
        leave_type=leave_in.leave_type,
        start_date=leave_in.start_date,
        end_date=leave_in.end_date,
        reason=leave_in.reason.strip(),
        status="Pending",
    )
    db.add(leave_req)
    db.commit()
    db.refresh(leave_req)
    return leave_req


def review_leave_request(
    db: Session,
    leave_id: UUID,
    reviewer_user_id: UUID,
    review_in: LeaveRequestReview,
) -> LeaveRequest:
    leave_req = db.query(LeaveRequest).filter(LeaveRequest.leave_id == leave_id).first()
    if not leave_req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Leave request {leave_id} not found.",
        )

    if leave_req.status != "Pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot review a leave request that is already {leave_req.status}.",
        )

    if review_in.status not in ["Approved", "Rejected"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Status must be 'Approved' or 'Rejected'.",
        )

    if review_in.status == "Rejected":
        rejection_reason = (review_in.rejection_reason or "").strip()
        if not rejection_reason:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Rejection reason is required when rejecting a leave request.",
            )
        leave_req.rejection_reason = rejection_reason

    leave_req.status = review_in.status
    leave_req.reviewed_by = reviewer_user_id
    leave_req.reviewed_at = datetime.now(timezone.utc)

    db.add(leave_req)
    db.commit()

    # Attendance Integration on Approval
    if review_in.status == "Approved":
        curr = leave_req.start_date
        while curr <= leave_req.end_date:
            upsert_attendance(
                db,
                AttendanceCreate(
                    driver_id=leave_req.driver_id,
                    date=curr,
                    status="Leave",
                ),
            )
            curr += timedelta(days=1)
    # In-App Notification Integration
    from app.crud.notification import notify_leave_approval, notify_leave_rejection
    if review_in.status == "Approved":
        notify_leave_approval(db, leave_req)
    elif review_in.status == "Rejected":
        notify_leave_rejection(db, leave_req)

    db.refresh(leave_req)

    # Email Notification Integration (Dispatched after DB transaction committed)
    try:
        driver = db.query(Driver).filter(Driver.driver_id == leave_req.driver_id).first()
        driver_user = db.query(User).filter(User.user_id == driver.user_id).first() if driver else None
        reviewer_user = db.query(User).filter(User.user_id == reviewer_user_id).first()

        if driver_user and driver_user.email:
            days_count = (leave_req.end_date - leave_req.start_date).days + 1
            reviewer_name = reviewer_user.full_name if reviewer_user else "Fleet Manager"
            review_date_str = leave_req.reviewed_at.strftime("%Y-%m-%d %H:%M UTC") if leave_req.reviewed_at else str(date.today())

            if review_in.status == "Approved":
                send_leave_approval_email(
                    to_email=driver_user.email,
                    driver_name=driver_user.full_name,
                    leave_type=leave_req.leave_type,
                    start_date=str(leave_req.start_date),
                    end_date=str(leave_req.end_date),
                    days_count=days_count,
                    reviewer_name=reviewer_name,
                    review_date=review_date_str,
                )
            elif review_in.status == "Rejected":
                send_leave_rejection_email(
                    to_email=driver_user.email,
                    driver_name=driver_user.full_name,
                    leave_type=leave_req.leave_type,
                    start_date=str(leave_req.start_date),
                    end_date=str(leave_req.end_date),
                    days_count=days_count,
                    rejection_reason=leave_req.rejection_reason or "",
                    reviewer_name=reviewer_name,
                    review_date=review_date_str,
                )
    except Exception as e:
        import logging
        logging.getLogger("fleetflow.email").error(f"Failed to send leave review notification email: {e}")

    return leave_req


def cancel_leave_request(db: Session, leave_id: UUID, driver_id: UUID) -> LeaveRequest:
    leave_req = db.query(LeaveRequest).filter(LeaveRequest.leave_id == leave_id).first()
    if not leave_req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Leave request {leave_id} not found.",
        )

    if leave_req.driver_id != driver_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: You can only cancel your own leave requests.",
        )

    if leave_req.status != "Pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only pending leave requests can be cancelled. Current status is {leave_req.status}.",
        )

    leave_req.status = "Cancelled"
    db.add(leave_req)
    db.commit()
    db.refresh(leave_req)
    return leave_req


def get_leave_request_by_id(db: Session, leave_id: UUID) -> LeaveRequest | None:
    return db.query(LeaveRequest).filter(LeaveRequest.leave_id == leave_id).first()


def build_leave_request_read(db: Session, leave_req: LeaveRequest) -> LeaveRequestRead:
    driver = db.query(Driver).filter(Driver.driver_id == leave_req.driver_id).first()
    driver_user = db.query(User).filter(User.user_id == driver.user_id).first() if driver else None

    reviewer_user = (
        db.query(User).filter(User.user_id == leave_req.reviewed_by).first()
        if leave_req.reviewed_by
        else None
    )

    days_count = (leave_req.end_date - leave_req.start_date).days + 1

    return LeaveRequestRead(
        leave_id=leave_req.leave_id,
        driver_id=leave_req.driver_id,
        leave_type=leave_req.leave_type,
        start_date=leave_req.start_date,
        end_date=leave_req.end_date,
        days_count=days_count,
        reason=leave_req.reason,
        status=leave_req.status,
        rejection_reason=leave_req.rejection_reason,
        reviewed_by=leave_req.reviewed_by,
        reviewed_at=leave_req.reviewed_at,
        created_at=leave_req.created_at,
        updated_at=leave_req.updated_at,
        driver_name=driver_user.full_name if driver_user else "Unknown Driver",
        driver_email=driver_user.email if driver_user else None,
        reviewer_name=reviewer_user.full_name if reviewer_user else None,
    )


def get_driver_leave_requests(
    db: Session,
    driver_id: UUID,
    status_filter: str | None = None,
) -> list[LeaveRequestRead]:
    query = db.query(LeaveRequest).filter(LeaveRequest.driver_id == driver_id)
    if status_filter:
        query = query.filter(LeaveRequest.status.ilike(status_filter))

    records = query.order_by(LeaveRequest.created_at.desc()).all()
    return [build_leave_request_read(db, r) for r in records]


def get_all_leave_requests(
    db: Session,
    status_filter: str | None = None,
) -> list[LeaveRequestRead]:
    query = db.query(LeaveRequest)
    if status_filter:
        query = query.filter(LeaveRequest.status.ilike(status_filter))

    # Order pending first, then by created_at desc
    from sqlalchemy import case
    records = (
        query.order_by(
            case((LeaveRequest.status == "Pending", 1), else_=2),
            LeaveRequest.created_at.desc(),
        )
        .all()
    )
    return [build_leave_request_read(db, r) for r in records]
