"""
Test script for 5-day, 1-day, and continuous due/overdue maintenance alerts,
plus resolution workflow.
"""
from datetime import date, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.user import User, RoleEnum
from app.models.vehicle import Vehicle
from app.models.maintenance import VehicleMaintenance
from app.models.notification import Notification
from app.core.security import hash_password, create_access_token
from app.tasks.maintenance import process_maintenance_alerts

client = TestClient(app)

def setup_test():
    db = SessionLocal()
    
    # 1. Ensure Admin & FleetManager exist
    admin = db.query(User).filter(User.email == "admin@fleetflow.com").first()
    if not admin:
        admin = User(
            email="admin@fleetflow.com",
            full_name="Admin User",
            password=hash_password("password123"),
            role=RoleEnum.Admin,
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)

    # 2. Ensure test vehicle exists
    veh = db.query(Vehicle).filter(Vehicle.registration_number == "TEST-MAINT-01").first()
    if not veh:
        veh = Vehicle(
            registration_number="TEST-MAINT-01",
            vehicle_type="Heavy Duty Truck",
            status="Available",
        )
        db.add(veh)
        db.commit()
        db.refresh(veh)

    # Clear previous test maintenance records for this vehicle
    db.query(VehicleMaintenance).filter(VehicleMaintenance.vehicle_id == veh.vehicle_id).delete()
    db.commit()

    today = date.today()

    # Create 4 test maintenance records:
    # 1. 5 days before service date (Scheduled)
    rec_5d = VehicleMaintenance(
        vehicle_id=veh.vehicle_id,
        maintenance_type="5-Day Test Inspection",
        service_date=today + timedelta(days=5),
        cost=120.0,
        status="Scheduled",
    )
    # 2. 1 day before service date (Scheduled)
    rec_1d = VehicleMaintenance(
        vehicle_id=veh.vehicle_id,
        maintenance_type="1-Day Urgent Brake Check",
        service_date=today + timedelta(days=1),
        cost=250.0,
        status="Scheduled",
    )
    # 3. Due today / Overdue (Scheduled - should keep triggering until Resolved)
    rec_due = VehicleMaintenance(
        vehicle_id=veh.vehicle_id,
        maintenance_type="Due Engine Overhaul",
        service_date=today - timedelta(days=2),
        cost=600.0,
        status="Scheduled",
    )
    # 4. Due today / Overdue but already RESOLVED (Must be IGNORED)
    rec_resolved = VehicleMaintenance(
        vehicle_id=veh.vehicle_id,
        maintenance_type="Resolved Tire Replacement",
        service_date=today - timedelta(days=3),
        cost=300.0,
        status="Resolved",
    )

    db.add_all([rec_5d, rec_1d, rec_due, rec_resolved])
    db.commit()
    db.refresh(rec_5d)
    db.refresh(rec_1d)
    db.refresh(rec_due)
    db.refresh(rec_resolved)

    db.close()
    return rec_5d.maintenance_id, rec_1d.maintenance_id, rec_due.maintenance_id, rec_resolved.maintenance_id

def run_tests():
    id_5d, id_1d, id_due, id_resolved = setup_test()
    db = SessionLocal()

    print("=== Testing 1: Process Maintenance Alerts Engine ===")
    triggered = process_maintenance_alerts(db)
    triggered_ids = [a["maintenance_id"] for a in triggered]

    # Verify 5-day alert triggered
    assert str(id_5d) in triggered_ids, "Expected 5-day advance alert to trigger"
    alert_5d = next(a for a in triggered if a["maintenance_id"] == str(id_5d))
    assert alert_5d["level"] == "5_DAYS_BEFORE"
    print("[PASS] 5-day advance alert triggered successfully.")

    # Verify 1-day alert triggered
    assert str(id_1d) in triggered_ids, "Expected 1-day urgent alert to trigger"
    alert_1d = next(a for a in triggered if a["maintenance_id"] == str(id_1d))
    assert alert_1d["level"] == "1_DAY_BEFORE"
    print("[PASS] 1-day urgent alert triggered successfully.")

    # Verify Due/Overdue alert triggered
    assert str(id_due) in triggered_ids, "Expected due/overdue alert to trigger"
    alert_due = next(a for a in triggered if a["maintenance_id"] == str(id_due))
    assert alert_due["level"] == "OVERDUE"
    print("[PASS] Due/overdue continuous alert triggered successfully.")

    # Verify Resolved record was IGNORED
    assert str(id_resolved) not in triggered_ids, "Resolved maintenance record should be completely ignored"
    print("[PASS] Resolved maintenance record was IGNORED as expected.")

    # Verify notifications saved in DB
    notifs = db.query(Notification).filter(Notification.type.like("MAINTENANCE_%")).all()
    assert len(notifs) >= 3, f"Expected at least 3 notifications, got {len(notifs)}"
    print(f"[PASS] Notifications created in database ({len(notifs)} total notifications).")

    print("\n=== Testing 2: API Endpoints ===")
    token = create_access_token({"sub": "admin@fleetflow.com", "role": "Admin"})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Test GET /maintenance/alerts
    res = client.get("/maintenance/alerts", headers=headers)
    assert res.status_code == 200, f"Failed GET /maintenance/alerts: {res.text}"
    data = res.json()
    alert_ids_api = [a["maintenance_id"] for a in data["alerts"]]
    assert str(id_5d) in alert_ids_api
    assert str(id_1d) in alert_ids_api
    assert str(id_due) in alert_ids_api
    assert str(id_resolved) not in alert_ids_api
    print("[PASS] GET /maintenance/alerts returned correct active alerts.")

    # 2. Test POST /maintenance/{id}/resolve (Resolve the overdue record)
    res = client.post(f"/maintenance/{id_due}/resolve", headers=headers)
    assert res.status_code == 200, f"Failed to resolve maintenance: {res.text}"
    assert res.json()["status"] == "Resolved"
    print("[PASS] POST /maintenance/{id}/resolve successfully updated status to Resolved.")

    # 3. Test that resolved record is now IGNORED by alert query and task
    res_after = client.get("/maintenance/alerts", headers=headers)
    alert_ids_after = [a["maintenance_id"] for a in res_after.json()["alerts"]]
    assert str(id_due) not in alert_ids_after, "Newly resolved record should no longer appear in alerts"
    print("[PASS] After resolution, record is immediately IGNORED and excluded from alerts.")

    db.close()
    print("\nALL MAINTENANCE NOTIFICATION & RESOLUTION TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_tests()
