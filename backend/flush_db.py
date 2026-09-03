import sys
from datetime import datetime, timedelta
import uuid
sys.path.insert(0, '.')

from app.database import SessionLocal, engine
from app.models.user import User, RoleEnum
from app.models.driver import Driver
from app.models.vehicle import Vehicle
from app.models.shipment import Shipment, ShipmentStatusEnum
from app.models.trip import Trip
from app.models.maintenance import VehicleMaintenance
from app.models.fuel_record import FuelRecord
from app.models.gps_tracking import GPSTracking
from app.core.security import hash_password
from sqlalchemy import text

def flush_database(mode="demo"):
    db = SessionLocal()
    print("Flushing database tables...")
    
    tables = [
        "leave_requests",
        "shipment_history",
        "trips",
        "shipments",
        "vehicle_maintenance",
        "notifications",
        "gps_tracking",
        "fuel_records",
        "attendance",
        "vehicles",
        "drivers",
        "users"
    ]
    
    with engine.connect() as conn:
        for t in tables:
            try:
                conn.execute(text(f"TRUNCATE TABLE {t} RESTART IDENTITY CASCADE;"))
                print(f"[OK] Truncated table: {t}")
            except Exception as e:
                print(f"[Notice] Could not truncate table {t}: {e}")
        conn.commit()

    if mode == "clean":
        print("\n[OK] All tables flushed. Database is completely empty.")
        db.close()
        return

    if mode == "admin":
        print("\nSeeding initial System Administrator account only...")
        admin_user = User(
            email="admin@fleetflow.com",
            password=hash_password("admin123"),
            full_name="System Administrator",
            role=RoleEnum.Admin,
            phone="+1-800-555-0101",
            is_verified=True,
        )
        db.add(admin_user)
        db.commit()
        db.close()
        print("[OK] Admin account created: admin@fleetflow.com / admin123")
        return

    print("\nSeeding clean default role accounts...")

    admin_user = User(
        email="admin@fleetflow.com",
        password=hash_password("admin123"),
        full_name="System Administrator",
        role=RoleEnum.Admin,
        phone="+1-800-555-0101",
        is_verified=True,
    )
    manager_user = User(
        email="manager@fleetflow.com",
        password=hash_password("admin123"),
        full_name="Fleet Manager",
        role=RoleEnum.FleetManager,
        phone="+1-800-555-0102",
        is_verified=True,
    )
    dispatcher_user = User(
        email="dispatcher@fleetflow.com",
        password=hash_password("admin123"),
        full_name="Logistics Dispatcher",
        role=RoleEnum.Dispatcher,
        phone="+1-800-555-0103",
        is_verified=True,
    )
    driver_user = User(
        email="driver@fleetflow.com",
        password=hash_password("admin123"),
        full_name="John Driver",
        role=RoleEnum.Driver,
        phone="+1-800-555-0104",
        is_verified=True,
    )

    db.add_all([admin_user, manager_user, dispatcher_user, driver_user])
    db.commit()
    db.refresh(driver_user)

    print("\nSeeding Drivers...")
    driver_1 = Driver(
        user_id=driver_user.user_id,
        license_number="CDL-98234-TX",
        experience_years=6,
        address="Kollam Logistics Depot - Bay 3",
        status="Active"
    )
    driver_2 = Driver(
        license_number="CDL-44109-CA",
        experience_years=4,
        address="Mumbai Central Hub",
        status="Active"
    )
    driver_3 = Driver(
        license_number="CDL-77231-NY",
        experience_years=8,
        address="Delhi North Terminal",
        status="Active"
    )

    db.add_all([driver_1, driver_2, driver_3])
    db.commit()
    db.refresh(driver_1)
    db.refresh(driver_2)
    db.refresh(driver_3)

    print("\nSeeding Vehicles...")
    veh_1 = Vehicle(
        registration_number="TRK-1001",
        vehicle_type="Heavy Truck",
        brand="BharatBenz",
        model="5528T",
        manufacture_year=2023,
        fuel_type="Diesel",
        capacity=15000,
        assigned_driver=driver_1.driver_id,
        status="In Use"
    )
    veh_2 = Vehicle(
        registration_number="VAN-2002",
        vehicle_type="Cargo Van",
        brand="Mercedes-Benz",
        model="Sprinter 3500",
        manufacture_year=2024,
        fuel_type="Diesel",
        capacity=3500,
        assigned_driver=driver_2.driver_id,
        status="Available"
    )
    veh_3 = Vehicle(
        registration_number="TRK-1003",
        vehicle_type="Refrigerated Truck",
        brand="Volvo",
        model="FH16 Globetrotter",
        manufacture_year=2022,
        fuel_type="Diesel",
        capacity=12000,
        assigned_driver=driver_3.driver_id,
        status="In Use"
    )

    db.add_all([veh_1, veh_2, veh_3])
    db.commit()
    db.refresh(veh_1)
    db.refresh(veh_2)
    db.refresh(veh_3)

    print("\nSeeding Shipments...")
    s1 = Shipment(
        tracking_number="FF-2026-A1B2C3D4",
        source="Kollam Logistics Hub",
        destination="Mumbai Depot",
        customer_name="AeroFreight Corp",
        customer_phone="+91 98765 43210",
        shipment_weight=8500.0,
        vehicle_id=veh_1.vehicle_id,
        driver_id=driver_1.driver_id,
        status=ShipmentStatusEnum.InTransit.value,
        source_lat=8.8932,
        source_lon=76.6141,
        destination_lat=19.0760,
        destination_lon=72.8777,
        expected_delivery=datetime.utcnow() + timedelta(hours=14),
        notes="High priority electronic goods delivery"
    )
    s2 = Shipment(
        tracking_number="FF-2026-X9Y8Z7W6",
        source="Delhi Terminal",
        destination="Bangalore Logistics Park",
        customer_name="Nexus Express",
        customer_phone="+91 91234 56789",
        shipment_weight=12000.0,
        vehicle_id=veh_3.vehicle_id,
        driver_id=driver_3.driver_id,
        status=ShipmentStatusEnum.InTransit.value,
        source_lat=28.6139,
        source_lon=77.2090,
        destination_lat=12.9716,
        destination_lon=77.5946,
        expected_delivery=datetime.utcnow() + timedelta(hours=22),
        notes="Cold storage temperature sensitive cargo"
    )
    s3 = Shipment(
        tracking_number="FF-2026-P4Q5R6S7",
        source="Chennai Port",
        destination="Hyderabad Hub",
        customer_name="Apex Logistics Ltd",
        customer_phone="+91 99887 76655",
        shipment_weight=3200.0,
        vehicle_id=veh_2.vehicle_id,
        driver_id=driver_2.driver_id,
        status=ShipmentStatusEnum.Assigned.value,
        source_lat=13.0827,
        source_lon=80.2707,
        destination_lat=17.3850,
        destination_lon=78.4867,
        expected_delivery=datetime.utcnow() + timedelta(hours=10),
        notes="Scheduled for dispatch"
    )

    db.add_all([s1, s2, s3])
    db.commit()
    db.refresh(s1)
    db.refresh(s2)
    db.refresh(s3)

    print("\nSeeding Trips...")
    t1 = Trip(
        vehicle_id=veh_1.vehicle_id,
        driver_id=driver_1.driver_id,
        shipment_id=s1.shipment_id,
        start_location="Kollam Logistics Hub",
        destination="Mumbai Depot",
        start_time=datetime.utcnow() - timedelta(hours=2),
        distance=1280.0,
        estimated_duration=16.5,
        planned_route_type="fastest",
        status="In Progress"
    )
    t2 = Trip(
        vehicle_id=veh_3.vehicle_id,
        driver_id=driver_3.driver_id,
        shipment_id=s2.shipment_id,
        start_location="Delhi Terminal",
        destination="Bangalore Logistics Park",
        start_time=datetime.utcnow() - timedelta(hours=4),
        distance=2150.0,
        estimated_duration=24.0,
        planned_route_type="fuel_efficient",
        status="In Progress"
    )

    db.add_all([t1, t2])
    db.commit()

    print("\nSeeding GPS Pings for Live Tracking...")
    gps1 = GPSTracking(
        vehicle_id=veh_1.vehicle_id,
        latitude=13.0827,
        longitude=75.2707,
        speed=68.5,
        heading=330.0,
        recorded_time=datetime.utcnow()
    )
    gps2 = GPSTracking(
        vehicle_id=veh_3.vehicle_id,
        latitude=21.1458,
        longitude=79.0882,
        speed=72.0,
        heading=180.0,
        recorded_time=datetime.utcnow()
    )

    db.add_all([gps1, gps2])
    db.commit()

    print("\nSeeding Maintenance & Fuel Logs...")
    m1 = VehicleMaintenance(
        vehicle_id=veh_1.vehicle_id,
        maintenance_type="Synthetic Engine Oil & Filter Change",
        service_date=(datetime.utcnow() - timedelta(days=15)).date(),
        next_service_date=(datetime.utcnow() + timedelta(days=75)).date(),
        cost=320.0,
        remarks="Routine preventive maintenance",
        status="Completed"
    )
    f1 = FuelRecord(
        vehicle_id=veh_1.vehicle_id,
        fuel_amount=120.0,
        fuel_cost=156.0,
        mileage=45200.0,
        refill_date=(datetime.utcnow() - timedelta(days=2)).date()
    )

    db.add_all([m1, f1])
    db.commit()
    db.close()
    print("[OK] Full database re-seeding completed successfully!")

if __name__ == "__main__":
    mode = "demo"
    if "--clean-only" in sys.argv:
        mode = "clean"
    elif "--admin-only" in sys.argv:
        mode = "admin"
    flush_database(mode=mode)
