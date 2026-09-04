from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db, require_roles
from app.crud import driver as driver_crud
from app.models.user import User
from app.schemas.driver import DriverCreate, DriverRead, DriverUpdate

router = APIRouter(tags=["drivers"])


@router.get("/", response_model=list[DriverRead])
def list_drivers(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[DriverRead]:
    """
    List driver profiles with vehicle assignment details.
    - Admin & FleetManager view all drivers.
    - Drivers only view their own driver profile.
    """
    return driver_crud.get_drivers_list(
        db=db,
        current_user=current_user,
        skip=skip,
        limit=limit,
    )


@router.post(
    "/",
    response_model=DriverRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("Admin", "FleetManager"))],
)
def register_driver_profile(
    driver_in: DriverCreate,
    db: Session = Depends(get_db),
) -> DriverRead:
    """Register or initialize a driver profile for an existing User account. Restricted to Admin & FleetManager."""
    user = db.query(User).filter(User.user_id == driver_in.user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {driver_in.user_id} not found.",
        )

    driver = driver_crud.create_driver_profile(db, driver_in)
    read_data = driver_crud.get_single_driver_details(db, driver.driver_id)
    if not read_data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve created driver profile.",
        )
    return read_data


@router.get("/{driver_id}", response_model=DriverRead)
def get_driver_profile(
    driver_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DriverRead:
    """Get single driver profile by driver ID. Scoped for Drivers to own profile only."""
    driver_read = driver_crud.get_single_driver_details(db, driver_id)
    if not driver_read:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver profile not found.",
        )

    if current_user.role == "Driver" and driver_read.user_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Drivers can only view their own profile.",
        )

    return driver_read


@router.put(
    "/{driver_id}",
    response_model=DriverRead,
    dependencies=[Depends(require_roles("Admin", "FleetManager"))],
)
def update_driver_profile_endpoint(
    driver_id: UUID,
    driver_in: DriverUpdate,
    db: Session = Depends(get_db),
) -> DriverRead:
    """Update driver profile details. Restricted to Admin & FleetManager."""
    updated = driver_crud.update_driver_profile(db, driver_id, driver_in)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver profile not found.",
        )

    read_data = driver_crud.get_single_driver_details(db, driver_id)
    if not read_data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve updated driver profile.",
        )
    return read_data
