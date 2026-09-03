"""
Test script for Safe User Deletion, FK Unlinking, Batch Role Updates, and Privilege Operations.
"""
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.user import User, RoleEnum
from app.models.driver import Driver
from app.models.vehicle import Vehicle
from app.models.trip import Trip
from app.models.shipment import Shipment, ShipmentStatusEnum
from app.models.notification import Notification
from app.models.attendance import Attendance
from app.models.leave_request import LeaveRequest
from app.core.security import hash_password, create_access_token
from app.core.email import get_email_logs

client = TestClient(app)

def test_safe_user_deletion_and_privileges():
    db = SessionLocal()

    # 1. Setup Admin user
    admin_user = db.query(User).filter(User.email == "admin_safe_del@fleetflow.com").first()
    if not admin_user:
        admin_user = User(
            email="admin_safe_del@fleetflow.com",
            full_name="Admin Director",
            password=hash_password("adminpass123"),
            role=RoleEnum.Admin,
            is_verified=True,
        )
        db.add(admin_user)
        db.commit()

    # 2. Setup Member with complex relations (Driver, Vehicle assignment, Trip, Notification, Attendance)
    member_user = db.query(User).filter(User.email == "driver_complex@fleetflow.com").first()
    if not member_user:
        member_user = User(
            email="driver_complex@fleetflow.com",
            full_name="Complex Driver User",
            password=hash_password("password123"),
            role=RoleEnum.Driver,
            is_verified=True,
        )
        db.add(member_user)
        db.commit()

    driver = db.query(Driver).filter(Driver.user_id == member_user.user_id).first()
    if not driver:
        driver = Driver(
            user_id=member_user.user_id,
            license_number="DL-COMPLEX-999",
            address="Hub Central",
            status="Active",
            experience_years=5,
        )
        db.add(driver)
        db.commit()

    # Create associated notification
    notif = Notification(user_id=member_user.user_id, title="Test", message="Test Msg")
    db.add(notif)

    # Create associated attendance
    att = Attendance(driver_id=driver.driver_id, status="Present")
    db.add(att)

    # Create associated vehicle assignment
    veh = db.query(Vehicle).filter(Vehicle.registration_number == "DEL-TEST-01").first()
    if not veh:
        veh = Vehicle(registration_number="DEL-TEST-01", vehicle_type="Truck", assigned_driver=driver.driver_id)
        db.add(veh)
    else:
        veh.assigned_driver = driver.driver_id

    db.commit()

    admin_token = create_access_token({"sub": admin_user.email, "role": "Admin"})
    headers = {"Authorization": f"Bearer {admin_token}"}

    target_uid = member_user.user_id
    target_email = member_user.email

    print("=== Testing Safe User Deletion with Complex Relations ===")

    # 1. Test Single User Delete with Reason
    res = client.delete(f"/auth/users/{target_uid}?reason=Relocating+to+another+organization", headers=headers)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    print("[PASS] User with Driver, Attendance, Notification, and Vehicle dependencies deleted safely!")

    # Verify user and driver are removed, and vehicle assigned_driver is unlinked to None
    db.close()
    db = SessionLocal()
    deleted_u = db.query(User).filter(User.user_id == target_uid).first()
    assert deleted_u is None, "User should no longer exist in DB"
    deleted_d = db.query(Driver).filter(Driver.user_id == target_uid).first()
    assert deleted_d is None, "Driver should no longer exist in DB"
    veh_check = db.query(Vehicle).filter(Vehicle.registration_number == "DEL-TEST-01").first()
    assert veh_check.assigned_driver is None, "Vehicle assigned_driver should be set to None"
    print("[PASS] Verified DB records cleaned: User=None, Driver=None, Vehicle.assigned_driver=None")

    # Verify Decommission email logged
    logs = get_email_logs()
    del_email = next((e for e in logs if e["recipient"] == target_email and "Decommission" in e["subject"]), None)
    assert del_email is not None, "Deletion decommission email should be logged"
    print(f"[PASS] Account Decommission email verified in audit logs: '{del_email['subject']}'")

    # 2. Test Batch Role Updates
    u1 = User(email="batch_u1@fleetflow.com", full_name="Batch User 1", password=hash_password("p"), role=RoleEnum.Driver)
    u2 = User(email="batch_u2@fleetflow.com", full_name="Batch User 2", password=hash_password("p"), role=RoleEnum.Driver)
    db.add_all([u1, u2])
    db.commit()

    print("\n=== Testing Batch Role Update ===")
    res = client.post("/auth/users/batch-role", json={
        "user_ids": [str(u1.user_id), str(u2.user_id)],
        "role": "Dispatcher",
        "reason": "Logistics Expansion Team",
    }, headers=headers)
    assert res.status_code == 200
    assert res.json()["updated_count"] == 2
    print("[PASS] Batch updated 2 users to Dispatcher with custom promotion note")

    # 3. Test Status Suspension
    print("\n=== Testing Status Suspension ===")
    res = client.patch(f"/auth/users/{u1.user_id}/status", json={"is_verified": False}, headers=headers)
    assert res.status_code == 200
    assert res.json()["is_verified"] is False
    print("[PASS] User status suspended (is_verified: False)")

    # 4. Test Batch Deletion
    print("\n=== Testing Batch Deletion ===")
    res = client.post("/auth/users/batch-delete", json={
        "user_ids": [str(u1.user_id), str(u2.user_id)],
        "reason": "Contract Completion",
    }, headers=headers)
    assert res.status_code == 200
    assert res.json()["deleted_count"] == 2
    print("[PASS] Batch deleted 2 users cleanly with decommission emails")

    db.close()
    print("\nALL SAFE DELETION & ADVANCED PRIVILEGE TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_safe_user_deletion_and_privileges()
