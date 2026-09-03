"""
Test script for Admin User Role Change Privileges and Email Dispatch.
"""
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.user import User, RoleEnum
from app.models.driver import Driver
from app.models.notification import Notification
from app.core.security import hash_password, create_access_token
from app.core.email import get_email_logs

client = TestClient(app)

def test_admin_role_change():
    db = SessionLocal()
    
    # 1. Setup Admin user
    admin_user = db.query(User).filter(User.email == "admin_test_rc@fleetflow.com").first()
    if not admin_user:
        admin_user = User(
            email="admin_test_rc@fleetflow.com",
            full_name="Admin Chief",
            password=hash_password("adminpass123"),
            role=RoleEnum.Admin,
            is_verified=True,
        )
        db.add(admin_user)
    
    # 2. Setup Member user (e.g. John Doe as Driver)
    john_user = db.query(User).filter(User.email == "john_driver@fleetflow.com").first()
    if not john_user:
        john_user = User(
            email="john_driver@fleetflow.com",
            full_name="John Doe",
            password=hash_password("driverpass123"),
            role=RoleEnum.Driver,
            is_verified=True,
        )
        db.add(john_user)
        db.flush()
    else:
        john_user.role = RoleEnum.Driver

    db.commit()
    john_id = str(john_user.user_id)
    admin_token = create_access_token({"sub": admin_user.email, "role": "Admin"})
    driver_token = create_access_token({"sub": john_user.email, "role": "Driver"})
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    driver_headers = {"Authorization": f"Bearer {driver_token}"}

    print("=== Testing Admin Role Change & Email Dispatch ===")

    # 1. Non-admin attempting to change role -> must return 403 Forbidden
    res = client.patch(f"/auth/users/{john_id}/role", json={"role": "FleetManager"}, headers=driver_headers)
    assert res.status_code == 403, f"Expected 403, got {res.status_code}"
    print("[PASS] Non-admin cannot change roles (403 Forbidden)")

    # 2. Admin changing John from Driver to FleetManager
    res = client.patch(f"/auth/users/{john_id}/role", json={"role": "FleetManager"}, headers=admin_headers)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    data = res.json()
    assert data["role"] == "FleetManager", f"Expected FleetManager, got {data['role']}"
    print("[PASS] Admin successfully changed John Doe's role from Driver to FleetManager (200 OK)")

    # 3. Check DB User record
    db.expire_all()
    updated_john = db.query(User).filter(User.user_id == john_user.user_id).first()
    assert updated_john.role == RoleEnum.FleetManager, f"DB role mismatch: {updated_john.role}"
    print("[PASS] Database User record verified as FleetManager")

    # 4. Check in-app notification creation
    notif = db.query(Notification).filter(Notification.user_id == john_user.user_id).order_by(Notification.created_at.desc()).first()
    assert notif is not None, "In-app notification was not created"
    assert "FleetManager" in notif.message, f"Notification text incorrect: {notif.message}"
    print(f"[PASS] In-app notification created: '{notif.title}' — '{notif.message}'")

    # 5. Check email audit logs
    email_logs = get_email_logs()
    john_email = next((e for e in email_logs if e["recipient"] == "john_driver@fleetflow.com"), None)
    assert john_email is not None, "Email was not logged in email audit log"
    assert "FleetManager" in john_email["subject"], f"Subject incorrect: {john_email['subject']}"
    print(f"[PASS] Email logged: Subject '{john_email['subject']}', Recipient: '{john_email['recipient']}'")

    # 6. Admin changing role to Dispatcher
    res = client.patch(f"/auth/users/{john_id}/role", json={"role": "Dispatcher"}, headers=admin_headers)
    assert res.status_code == 200
    assert res.json()["role"] == "Dispatcher"
    print("[PASS] Admin successfully changed John Doe's role to Dispatcher")

    # 7. Admin changing role back to Driver (verifying Driver record auto-handling)
    res = client.patch(f"/auth/users/{john_id}/role", json={"role": "Driver"}, headers=admin_headers)
    assert res.status_code == 200
    assert res.json()["role"] == "Driver"
    driver_record = db.query(Driver).filter(Driver.user_id == john_user.user_id).first()
    assert driver_record is not None, "Driver profile should exist"
    assert driver_record.status == "Active"
    print(f"[PASS] Transitioned back to Driver and verified active Driver record: License {driver_record.license_number}")

    # 8. Check Admin Dashboard operational KPIs including user_role_breakdown
    res = client.get("/dashboard/admin", headers=admin_headers)
    assert res.status_code == 200
    dash = res.json()
    assert "user_role_breakdown" in dash["operational_kpis"]
    print(f"[PASS] Admin Dashboard includes user_role_breakdown: {dash['operational_kpis']['user_role_breakdown']}")

    db.close()
    print("\nALL ADMIN ROLE CHANGE & EMAIL TESTS PASSED!")

if __name__ == "__main__":
    test_admin_role_change()
