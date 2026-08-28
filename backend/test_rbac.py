"""
Comprehensive RBAC validation test script for FleetFlow API.
"""
import sys
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal, engine, Base
from app.models.user import User, RoleEnum
from app.core.security import hash_password, create_access_token

client = TestClient(app)

def create_mock_tokens():
    admin_token = create_access_token({"sub": "admin@fleetflow.com", "role": "Admin"})
    fm_token = create_access_token({"sub": "fleetmgr@fleetflow.com", "role": "FleetManager"})
    disp_token = create_access_token({"sub": "dispatcher@fleetflow.com", "role": "Dispatcher"})
    driver_token = create_access_token({"sub": "driver@fleetflow.com", "role": "Driver"})
    return {
        "Admin": {"Authorization": f"Bearer {admin_token}"},
        "FleetManager": {"Authorization": f"Bearer {fm_token}"},
        "Dispatcher": {"Authorization": f"Bearer {disp_token}"},
        "Driver": {"Authorization": f"Bearer {driver_token}"},
    }

def seed_users():
    db = SessionLocal()
    roles = [
        ("admin@fleetflow.com", "Admin User", RoleEnum.Admin),
        ("fleetmgr@fleetflow.com", "Fleet Manager", RoleEnum.FleetManager),
        ("dispatcher@fleetflow.com", "Dispatcher User", RoleEnum.Dispatcher),
        ("driver@fleetflow.com", "Driver User", RoleEnum.Driver),
    ]
    for email, name, role in roles:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            user = User(
                email=email,
                full_name=name,
                password=hash_password("password123"),
                role=role,
            )
            db.add(user)
    db.commit()
    db.close()

def run_tests():
    seed_users()
    headers = create_mock_tokens()
    
    print("=== Testing Milestone 1: User & Vehicle Gating ===")
    
    # 1. Admin Add User
    res = client.post("/auth/admin/add-user", json={"full_name": "Test User", "email": "test_rbac@test.com", "role": "Driver", "temporary_password": "p"}, headers=headers["FleetManager"])
    assert res.status_code == 403, f"Expected 403 for FM adding user, got {res.status_code}"
    print("[PASS] FleetManager cannot provision accounts (403)")

    res = client.post("/auth/admin/add-user", json={"full_name": "Test User", "email": "test_rbac@test.com", "role": "Driver", "temporary_password": "p"}, headers=headers["Dispatcher"])
    assert res.status_code == 403, f"Expected 403 for Dispatcher adding user, got {res.status_code}"
    print("[PASS] Dispatcher cannot provision accounts (403)")

    # 2. Email Logs
    res = client.get("/auth/email-logs", headers=headers["FleetManager"])
    assert res.status_code == 403, f"Expected 403 for FM email logs, got {res.status_code}"
    print("[PASS] FleetManager cannot view email logs (403)")

    # 3. Vehicle Creation
    res = client.post("/vehicles/", json={"registration_number": "TEST-RBAC-01", "vehicle_type": "Cargo Van"}, headers=headers["Dispatcher"])
    assert res.status_code == 403, f"Expected 403 for Dispatcher creating vehicle, got {res.status_code}"
    print("[PASS] Dispatcher cannot register vehicles (403)")

    res = client.post("/vehicles/", json={"registration_number": "TEST-RBAC-01", "vehicle_type": "Cargo Van"}, headers=headers["Driver"])
    assert res.status_code == 403, f"Expected 403 for Driver creating vehicle, got {res.status_code}"
    print("[PASS] Driver cannot register vehicles (403)")

    print("\n=== Testing Milestone 2: Trips & Tracking Gating ===")
    
    import uuid
    dummy_vid = str(uuid.uuid4())
    dummy_did = str(uuid.uuid4())

    # 4. Trip Scheduling
    res = client.post("/trips/", json={"vehicle_id": dummy_vid, "driver_id": dummy_did, "start_location": "Hub A", "destination": "Hub B", "planned_route_type": "fastest"}, headers=headers["Dispatcher"])
    assert res.status_code == 403, f"Expected 403 for Dispatcher scheduling trip, got {res.status_code}"
    print("[PASS] Dispatcher cannot schedule trips (403)")

    res = client.post("/trips/", json={"vehicle_id": dummy_vid, "driver_id": dummy_did, "start_location": "Hub A", "destination": "Hub B", "planned_route_type": "fastest"}, headers=headers["Driver"])
    assert res.status_code == 403, f"Expected 403 for Driver scheduling trip, got {res.status_code}"
    print("[PASS] Driver cannot schedule trips (403)")

    print("\n=== Testing Milestone 3: Maintenance & Fuel Gating ===")
    
    # 5. Maintenance Scheduling
    res = client.post("/maintenance/", json={"maintenance_type": "Brake Check", "service_date": "2026-08-14", "cost": 200}, headers=headers["Dispatcher"])
    assert res.status_code == 403, f"Expected 403 for Dispatcher logging maintenance, got {res.status_code}"
    print("[PASS] Dispatcher cannot log maintenance (403)")

    res = client.post("/maintenance/", json={"maintenance_type": "Brake Check", "service_date": "2026-08-14", "cost": 200}, headers=headers["Driver"])
    assert res.status_code == 403, f"Expected 403 for Driver logging maintenance (403), got {res.status_code}"
    print("[PASS] Driver cannot log maintenance (403)")

    # 6. Fuel Logs
    res = client.get("/maintenance/fuel", headers=headers["Dispatcher"])
    assert res.status_code == 403, f"Expected 403 for Dispatcher accessing fuel logs, got {res.status_code}"
    print("[PASS] Dispatcher cannot view fuel records (403)")

    print("\nALL RBAC GATING TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_tests()
