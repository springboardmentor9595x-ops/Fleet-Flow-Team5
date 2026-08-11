from uuid import UUID
from sqlalchemy.orm import Session

from app.models.vehicle import Vehicle
from app.schemas.vehicle import VehicleCreate, VehicleUpdate


def create_vehicle(db: Session, vehicle_in: VehicleCreate) -> Vehicle:
    """Create a new vehicle."""
    vehicle = Vehicle(
        registration_number=vehicle_in.registration_number.upper(),
        vehicle_type=vehicle_in.vehicle_type,
        brand=vehicle_in.brand,
        model=vehicle_in.model,
        manufacture_year=vehicle_in.manufacture_year,
        fuel_type=vehicle_in.fuel_type,
        capacity=vehicle_in.capacity,
        assigned_driver=vehicle_in.assigned_driver,
        status=vehicle_in.status,
    )
    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)
    return vehicle


def get_vehicle_by_id(db: Session, vehicle_id: UUID) -> Vehicle | None:
    """Get a vehicle by ID."""
    return db.query(Vehicle).filter(Vehicle.vehicle_id == vehicle_id).first()


def get_vehicle_by_registration(db: Session, registration_number: str) -> Vehicle | None:
    """Get a vehicle by registration number."""
    return db.query(Vehicle).filter(
        Vehicle.registration_number == registration_number.upper()
    ).first()


def get_all_vehicles(db: Session, skip: int = 0, limit: int = 100) -> list[Vehicle]:
    """Get all vehicles with pagination."""
    return db.query(Vehicle).offset(skip).limit(limit).all()


def get_vehicles_by_status(db: Session, status: str, skip: int = 0, limit: int = 100) -> list[Vehicle]:
    """Get vehicles filtered by status."""
    return db.query(Vehicle).filter(Vehicle.status == status).offset(skip).limit(limit).all()


def get_vehicles_by_driver(db: Session, driver_id: UUID, skip: int = 0, limit: int = 100) -> list[Vehicle]:
    """Get vehicles assigned to a specific driver."""
    return db.query(Vehicle).filter(Vehicle.assigned_driver == driver_id).offset(skip).limit(limit).all()


def update_vehicle(db: Session, vehicle_id: UUID, vehicle_in: VehicleUpdate) -> Vehicle | None:
    """Update a vehicle."""
    vehicle = get_vehicle_by_id(db, vehicle_id)
    if not vehicle:
        return None
    
    update_data = vehicle_in.model_dump(exclude_unset=True)
    if "registration_number" in update_data and update_data["registration_number"]:
        update_data["registration_number"] = update_data["registration_number"].upper()
    
    for field, value in update_data.items():
        setattr(vehicle, field, value)
    
    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)
    return vehicle


def delete_vehicle(db: Session, vehicle_id: UUID) -> bool:
    """Delete a vehicle."""
    vehicle = get_vehicle_by_id(db, vehicle_id)
    if not vehicle:
        return False
    
    db.delete(vehicle)
    db.commit()
    return True


def assign_driver_to_vehicle(db: Session, vehicle_id: UUID, driver_id: UUID | None) -> Vehicle | None:
    """Assign or unassign a driver to/from a vehicle."""
    vehicle = get_vehicle_by_id(db, vehicle_id)
    if not vehicle:
        return None
    
    vehicle.assigned_driver = driver_id
    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)
    return vehicle


def update_vehicle_status(db: Session, vehicle_id: UUID, status: str) -> Vehicle | None:
    """Update the status of a vehicle."""
    vehicle = get_vehicle_by_id(db, vehicle_id)
    if not vehicle:
        return None
    
    vehicle.status = status
    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)
    return vehicle


def get_vehicle_stats(db: Session) -> dict:
    """Get aggregated counts of vehicles by status."""
    all_vehicles = db.query(Vehicle).all()
    total = len(all_vehicles)
    available = sum(1 for v in all_vehicles if v.status.lower() == "available")
    in_transit = sum(1 for v in all_vehicles if v.status.lower() in ["in transit", "in_transit", "active"])
    maintenance = sum(1 for v in all_vehicles if v.status.lower() == "maintenance")
    out_of_service = sum(1 for v in all_vehicles if v.status.lower() in ["out of service", "out_of_service", "disabled"])
    return {
        "total": total,
        "available": available,
        "in_transit": in_transit,
        "maintenance": maintenance,
        "out_of_service": out_of_service,
    }
