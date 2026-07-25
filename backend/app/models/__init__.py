from app.models.user import User, RoleEnum
from app.models.driver import Driver
from app.models.vehicle import Vehicle
from app.models.shipment import Shipment
from app.models.trip import Trip
from app.models.gps_tracking import GPSTracking
from app.models.maintenance import VehicleMaintenance
from app.models.fuel_record import FuelRecord
from app.models.notification import Notification
from app.models.attendance import Attendance

__all__ = [
    "User",
    "RoleEnum",
    "Driver",
    "Vehicle",
    "Shipment",
    "Trip",
    "GPSTracking",
    "VehicleMaintenance",
    "FuelRecord",
    "Notification",
    "Attendance",
]
