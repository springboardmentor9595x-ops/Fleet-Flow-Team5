from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db, require_roles
from app.crud import leave_request as leave_crud
from app.models.driver import Driver
from app.models.user import User
from app.schemas.leave_request import LeaveRequestCreate, LeaveRequestRead, LeaveRequestReview

from app.crud.driver import get_driver_by_user_id

router = APIRouter(prefix="/leave-requests", tags=["leave-requests"])


def get_current_driver(user: User, db: Session) -> Driver:
    """Helper to retrieve Driver record for current logged in user with auto-healing."""
    if user.role != "Driver":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only users with Driver role can create or manage personal driver leave requests.",
        )
    driver = get_driver_by_user_id(db, user.user_id, auto_create=True)
    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver profile not found for this user account.",
        )
    return driver


@router.post("/", response_model=LeaveRequestRead, status_code=status.HTTP_201_CREATED)
def submit_leave_request(
    leave_in: LeaveRequestCreate,
    driver_id: UUID | None = Query(None, description="Optional target driver_id (Admin/Manager only)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LeaveRequestRead:
    """
    Submit a new leave request.
    - Drivers can submit leave requests for themselves.
    - Drivers CANNOT create leave requests for other drivers.
    """
    if current_user.role == "Driver":
        driver = get_current_driver(current_user, db)
        target_driver_id = driver.driver_id
    elif current_user.role in ["Admin", "FleetManager"]:
        # Admin or FleetManager submitting on behalf of a driver
        if not driver_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="driver_id is required when submitting a leave request as Admin/FleetManager.",
            )
        driver = db.query(Driver).filter((Driver.driver_id == driver_id) | (Driver.user_id == driver_id)).first()
        if not driver:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Driver with ID {driver_id} not found.",
            )
        target_driver_id = driver.driver_id
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access forbidden: User role '{current_user.role}' cannot submit leave requests.",
        )

    leave_req = leave_crud.create_leave_request(db, target_driver_id, leave_in)
    return leave_crud.build_leave_request_read(db, leave_req)


@router.get("/", response_model=list[LeaveRequestRead])
def list_leave_requests(
    status_filter: str | None = Query(None, alias="status", description="Filter by status (Pending, Approved, Rejected, Cancelled)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[LeaveRequestRead]:
    """
    Fetch leave requests.
    - Admin & FleetManager receive all fleet leave requests (Pending requests listed first).
    - Drivers receive their own leave requests.
    """
    if current_user.role in ["Admin", "FleetManager", "Dispatcher"]:
        return leave_crud.get_all_leave_requests(db, status_filter=status_filter)
    elif current_user.role == "Driver":
        driver = get_current_driver(current_user, db)
        return leave_crud.get_driver_leave_requests(db, driver.driver_id, status_filter=status_filter)
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Invalid role for leave request retrieval.",
        )


@router.get("/driver/{driver_id}", response_model=list[LeaveRequestRead])
def get_driver_leave_requests_endpoint(
    driver_id: UUID,
    status_filter: str | None = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[LeaveRequestRead]:
    """
    Fetch leave requests for a specific driver.
    - Admin & FleetManager can access any driver.
    - Driver can only access their own requests.
    """
    driver = db.query(Driver).filter((Driver.driver_id == driver_id) | (Driver.user_id == driver_id)).first()
    target_driver_id = driver.driver_id if driver else driver_id

    if current_user.role == "Driver":
        my_driver = get_current_driver(current_user, db)
        if my_driver.driver_id != target_driver_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: Drivers can only view their own leave requests.",
            )

    return leave_crud.get_driver_leave_requests(db, target_driver_id, status_filter=status_filter)


@router.post(
    "/{leave_id}/review",
    response_model=LeaveRequestRead,
    dependencies=[Depends(require_roles("Admin", "FleetManager"))],
)
def review_leave_request_endpoint(
    leave_id: UUID,
    review_in: LeaveRequestReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LeaveRequestRead:
    """
    Approve or Reject a pending leave request.
    Restricted to Admin and FleetManager. Drivers cannot approve leave.
    """
    leave_req = leave_crud.review_leave_request(db, leave_id, current_user.user_id, review_in)
    return leave_crud.build_leave_request_read(db, leave_req)


@router.post("/{leave_id}/cancel", response_model=LeaveRequestRead)
def cancel_leave_request_endpoint(
    leave_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LeaveRequestRead:
    """
    Cancel a pending leave request.
    Only allowed for the driver who submitted the request.
    """
    if current_user.role == "Driver":
        driver = get_current_driver(current_user, db)
        driver_id = driver.driver_id
    elif current_user.role in ["Admin", "FleetManager"]:
        # Admin / FleetManager can also cancel on behalf of driver
        leave_req = leave_crud.get_leave_request_by_id(db, leave_id)
        if not leave_req:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave request not found.")
        driver_id = leave_req.driver_id
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access forbidden: User role '{current_user.role}' cannot cancel leave requests.",
        )

    leave_req = leave_crud.cancel_leave_request(db, leave_id, driver_id)
    return leave_crud.build_leave_request_read(db, leave_req)
