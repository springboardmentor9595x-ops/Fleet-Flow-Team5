from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.driver import Driver
from app.models.user import User
from app.models.vehicle import Vehicle
from app.schemas.driver import DriverCreate, DriverUpdate, DriverRead


def get_driver_by_id(db: Session, driver_id: UUID) -> Driver | None:
    return db.query(Driver).filter(Driver.driver_id == driver_id).first()


def get_driver_by_user_id(db: Session, user_id: UUID, auto_create: bool = True) -> Driver | None:
    driver = db.query(Driver).filter(Driver.user_id == user_id).first()
    if driver:
        return driver

    if auto_create:
        user = db.query(User).filter(User.user_id == user_id).first()
        if user and user.role == "Driver":
            driver = Driver(user_id=user_id, status="Active")
            db.add(driver)
            db.commit()
            db.refresh(driver)
            return driver

    return None


def create_driver_profile(db: Session, driver_in: DriverCreate) -> Driver:
    # Ensure user exists and has role Driver
    user = db.query(User).filter(User.user_id == driver_in.user_id).first()
    if user and user.role != "Driver":
        user.role = "Driver"
        db.add(user)

    existing = get_driver_by_user_id(db, driver_in.user_id)
    if existing:
        existing.license_number = driver_in.license_number
        existing.experience_years = driver_in.experience_years
        existing.address = driver_in.address
        existing.status = driver_in.status
        db.add(existing)
        db.commit()
        db.refresh(existing)
        return existing

    driver = Driver(
        user_id=driver_in.user_id,
        license_number=driver_in.license_number,
        experience_years=driver_in.experience_years,
        address=driver_in.address,
        status=driver_in.status,
    )
    db.add(driver)
    db.commit()
    db.refresh(driver)
    return driver


def update_driver_profile(db: Session, driver_id: UUID, driver_in: DriverUpdate) -> Driver | None:
    driver = get_driver_by_id(db, driver_id)
    if not driver:
        return None

    update_data = driver_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(driver, field, value)

    db.add(driver)
    db.commit()
    db.refresh(driver)
    return driver


def build_driver_read(driver: Driver, user: User | None, assigned_vehicle: Vehicle | None) -> DriverRead:
    vehicle_reg = assigned_vehicle.registration_number if assigned_vehicle else None
    vehicle_model = f"{assigned_vehicle.brand or ''} {assigned_vehicle.model or ''}".strip() if assigned_vehicle else None
    vehicle_id = assigned_vehicle.vehicle_id if assigned_vehicle else None

    return DriverRead(
        driver_id=driver.driver_id,
        user_id=driver.user_id,
        license_number=driver.license_number,
        experience_years=driver.experience_years,
        address=driver.address,
        status=driver.status,
        created_at=driver.created_at,
        full_name=user.full_name if user else None,
        email=user.email if user else None,
        phone=user.phone if user else None,
        assigned_vehicle_id=vehicle_id,
        assigned_vehicle_registration=vehicle_reg,
        assigned_vehicle_model=vehicle_model,
    )


def get_drivers_list(
    db: Session,
    current_user: User,
    skip: int = 0,
    limit: int = 100,
) -> list[DriverRead]:
    query = db.query(Driver, User).join(User, Driver.user_id == User.user_id).filter(User.role == "Driver")

    if current_user.role == "Driver":
        query = query.filter(Driver.user_id == current_user.user_id)

    driver_user_pairs = query.offset(skip).limit(limit).all()

    # Also fetch all vehicles to map assigned drivers efficiently
    all_vehicles = db.query(Vehicle).all()

    results = []
    for driver, user in driver_user_pairs:
        # Find assigned vehicle
        assigned_vehicle = next(
            (v for v in all_vehicles if v.assigned_driver == driver.driver_id or v.assigned_driver == driver.user_id),
            None,
        )
        results.append(build_driver_read(driver, user, assigned_vehicle))

    return results


def get_single_driver_details(db: Session, driver_id: UUID) -> DriverRead | None:
    driver = get_driver_by_id(db, driver_id)
    if not driver:
        return None

    user = db.query(User).filter(User.user_id == driver.user_id).first()
    assigned_vehicle = db.query(Vehicle).filter(
        or_(Vehicle.assigned_driver == driver.driver_id, Vehicle.assigned_driver == driver.user_id)
    ).first()

    return build_driver_read(driver, user, assigned_vehicle)
