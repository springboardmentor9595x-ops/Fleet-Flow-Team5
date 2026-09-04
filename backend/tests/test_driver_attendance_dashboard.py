import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from datetime import date, timedelta
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.database import SessionLocal, Base, engine
from app.models.driver import Driver
from app.models.user import User
from app.models.attendance import Attendance
from app.core.security import create_access_token, hash_password


@pytest.fixture(scope="module")
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # Clean up test attendance, drivers, users for attendance tests
    db.query(Attendance).delete()
    db.query(Driver).delete()
    db.query(User).filter(User.email.like("%test_att_%")).delete()
    db.commit()

    # Create Admin user
    admin_user = User(
        email="test_att_admin@fleetflow.com",
        password=hash_password("AdminPass123!"),
        full_name="Attendance Test Admin",
        role="Admin",
        is_verified=True,
    )
    db.add(admin_user)

    # Create FleetManager user
    fm_user = User(
        email="test_att_fm@fleetflow.com",
        password=hash_password("ManagerPass123!"),
        full_name="Attendance Test Manager",
        role="FleetManager",
        is_verified=True,
    )
    db.add(fm_user)

    # Create Dispatcher user
    disp_user = User(
        email="test_att_disp@fleetflow.com",
        password=hash_password("DispPass123!"),
        full_name="Attendance Test Dispatcher",
        role="Dispatcher",
        is_verified=True,
    )
    db.add(disp_user)

    # Create Driver 1
    driver1_user = User(
        email="test_att_driver1@fleetflow.com",
        password=hash_password("DriverPass123!"),
        full_name="Attendance Driver One",
        role="Driver",
        is_verified=True,
    )
    db.add(driver1_user)

    # Create Driver 2
    driver2_user = User(
        email="test_att_driver2@fleetflow.com",
        password=hash_password("DriverPass123!"),
        full_name="Attendance Driver Two",
        role="Driver",
        is_verified=True,
    )
    db.add(driver2_user)
    db.commit()

    d1_profile = Driver(
        user_id=driver1_user.user_id,
        license_number="LIC-ATT-001",
        experience_years=5,
        status="Active",
    )
    d2_profile = Driver(
        user_id=driver2_user.user_id,
        license_number="LIC-ATT-002",
        experience_years=3,
        status="Active",
    )
    db.add(d1_profile)
    db.add(d2_profile)
    db.commit()

    admin_token = create_access_token(subject=admin_user.email)
    fm_token = create_access_token(subject=fm_user.email)
    disp_token = create_access_token(subject=disp_user.email)
    driver1_token = create_access_token(subject=driver1_user.email)
    driver2_token = create_access_token(subject=driver2_user.email)

    data = {
        "db": db,
        "admin_user": admin_user,
        "fm_user": fm_user,
        "disp_user": disp_user,
        "driver1_user": driver1_user,
        "driver1_profile": d1_profile,
        "driver2_user": driver2_user,
        "driver2_profile": d2_profile,
        "admin_token": admin_token,
        "fm_token": fm_token,
        "disp_token": disp_token,
        "driver1_token": driver1_token,
        "driver2_token": driver2_token,
    }
    yield data

    db.close()


def test_driver_attendance_summary_calculation_and_rbac(setup_db):
    client = TestClient(app)
    db = setup_db["db"]
    d1_profile = setup_db["driver1_profile"]
    d2_profile = setup_db["driver2_profile"]

    d1_headers = {"Authorization": f"Bearer {setup_db['driver1_token']}"}
    d2_headers = {"Authorization": f"Bearer {setup_db['driver2_token']}"}
    admin_headers = {"Authorization": f"Bearer {setup_db['admin_token']}"}
    fm_headers = {"Authorization": f"Bearer {setup_db['fm_token']}"}
    disp_headers = {"Authorization": f"Bearer {setup_db['disp_token']}"}

    # 1. Driver 1 initially has 0 attendance records
    res_empty = client.get("/attendance/me/summary", headers=d1_headers)
    assert res_empty.status_code == 200
    summary_empty = res_empty.json()
    assert summary_empty["total_days"] == 0
    assert summary_empty["present_days"] == 0
    assert summary_empty["absent_days"] == 0
    assert summary_empty["leave_days"] == 0
    assert summary_empty["attendance_rate_pct"] is None or summary_empty["attendance_rate_pct"] == 0.0

    # 2. Add 18 Present days, 2 Absent days, and 1 Leave day for Driver 1
    base_date = date(2026, 8, 1)
    # 18 Present days
    for i in range(18):
        db.add(Attendance(driver_id=d1_profile.driver_id, date=base_date + timedelta(days=i), status="Present"))
    # 2 Absent days
    for i in range(18, 20):
        db.add(Attendance(driver_id=d1_profile.driver_id, date=base_date + timedelta(days=i), status="Absent"))
    # 1 Leave day
    db.add(Attendance(driver_id=d1_profile.driver_id, date=base_date + timedelta(days=20), status="Leave"))

    # Also add 5 Present days for Driver 2 to ensure isolation
    for i in range(5):
        db.add(Attendance(driver_id=d2_profile.driver_id, date=base_date + timedelta(days=i), status="Present"))

    db.commit()

    # 3. Driver 1 calls /attendance/me/summary -> gets exact 18/21 calculation
    # Formula: Present (18) / Total (21) * 100 = 85.7%
    res_d1 = client.get("/attendance/me/summary", headers=d1_headers)
    assert res_d1.status_code == 200
    summary_d1 = res_d1.json()
    assert summary_d1["total_days"] == 21
    assert summary_d1["present_days"] == 18
    assert summary_d1["absent_days"] == 2
    assert summary_d1["leave_days"] == 1
    # 18 / 21 = 85.714... -> rounded to 85.7
    assert summary_d1["attendance_rate_pct"] == 85.7

    # 4. Driver 1 calls /attendance/me -> gets attendance history list (21 records)
    res_d1_hist = client.get("/attendance/me", headers=d1_headers)
    assert res_d1_hist.status_code == 200
    assert len(res_d1_hist.json()) == 21

    # Date filter check: GET /attendance/me?date=2026-08-01 -> returns 1 Present record
    res_date_match = client.get("/attendance/me?date=2026-08-01", headers=d1_headers)
    assert res_date_match.status_code == 200
    assert len(res_date_match.json()) == 1
    assert res_date_match.json()[0]["status"] == "Present"

    # Date filter check: GET /attendance/me?date=2026-09-02 -> returns 0 records
    res_date_nomatch = client.get("/attendance/me?date=2026-09-02", headers=d1_headers)
    assert res_date_nomatch.status_code == 200
    assert len(res_date_nomatch.json()) == 0

    # 5. PRIVACY CHECK: Driver 1 CANNOT view Driver 2's summary by passing driver2_id -> 403 Forbidden
    res_tamper_summary = client.get(f"/attendance/driver/{d2_profile.driver_id}/summary", headers=d1_headers)
    assert res_tamper_summary.status_code == 403

    # PRIVACY CHECK: Driver 1 CANNOT view Driver 2's attendance history -> 403 Forbidden
    res_tamper_hist = client.get(f"/attendance/driver/{d2_profile.driver_id}", headers=d1_headers)
    assert res_tamper_hist.status_code == 403

    # PRIVACY CHECK: Driver 1 CANNOT view fleet-wide attendance list -> 403 Forbidden
    res_fleet_privacy = client.get("/attendance/", headers=d1_headers)
    assert res_fleet_privacy.status_code == 403

    # 6. ADMIN & FLEET MANAGER PERMISSIONS CHECK
    # Admin can view Driver 1 summary
    res_admin_sum = client.get(f"/attendance/driver/{d1_profile.driver_id}/summary", headers=admin_headers)
    assert res_admin_sum.status_code == 200
    assert res_admin_sum.json()["present_days"] == 18

    # Fleet Manager can view Driver 1 summary
    res_fm_sum = client.get(f"/attendance/driver/{d1_profile.driver_id}/summary", headers=fm_headers)
    assert res_fm_sum.status_code == 200
    assert res_fm_sum.json()["present_days"] == 18

    # Dispatcher can view fleet attendance list (read-only)
    res_disp_fleet = client.get("/attendance/", headers=disp_headers)
    assert res_disp_fleet.status_code == 200
    assert len(res_disp_fleet.json()) >= 26
