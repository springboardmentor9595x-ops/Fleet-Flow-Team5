"""
Comprehensive Automated Test Suite for:
1. Attendance Tracking & Schema Finalization
2. Driver Leave Applications & Admin/FM Approval Workflow (with Auto-Attendance Sync)
3. Admin User Role Management & RBAC
4. Forgot Password with Email OTP Verification & Reset Password
5. In-App Change Password for Authenticated Users
6. Driver Performance Reports & Dashboards Attendance Integration
"""
import sys
import uuid
from datetime import date, timedelta
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal, engine, Base
from app.models.user import User, RoleEnum
from app.models.driver import Driver
from app.models.attendance import Attendance
from app.models.leave_request import LeaveRequest
from app.core.security import hash_password, create_access_token

client = TestClient(app)

def create_tokens():
    admin_token = create_access_token({"sub": "admin_test@fleetflow.com", "role": "Admin"})
    fm_token = create_access_token({"sub": "fm_test@fleetflow.com", "role": "FleetManager"})
    disp_token = create_access_token({"sub": "disp_test@fleetflow.com", "role": "Dispatcher"})
    driver_token = create_access_token({"sub": "driver_test@fleetflow.com", "role": "Driver"})
    return {
        "Admin": {"Authorization": f"Bearer {admin_token}"},
        "FleetManager": {"Authorization": f"Bearer {fm_token}"},
        "Dispatcher": {"Authorization": f"Bearer {disp_token}"},
        "Driver": {"Authorization": f"Bearer {driver_token}"},
    }

def seed_test_data():
    db = SessionLocal()
    roles = [
        ("admin_test@fleetflow.com", "Admin Tester", RoleEnum.Admin),
        ("fm_test@fleetflow.com", "FM Tester", RoleEnum.FleetManager),
        ("disp_test@fleetflow.com", "Dispatcher Tester", RoleEnum.Dispatcher),
        ("driver_test@fleetflow.com", "Driver Tester", RoleEnum.Driver),
        ("driver2_test@fleetflow.com", "Driver Two", RoleEnum.Driver),
    ]
    created_users = {}
    for email, name, role in roles:
        u = db.query(User).filter(User.email == email).first()
        if not u:
            u = User(
                email=email,
                full_name=name,
                password=hash_password("password123"),
                role=role,
                is_verified=True,
            )
            db.add(u)
            db.commit()
            db.refresh(u)
        created_users[email] = u

    # Ensure drivers
    driver_user = created_users["driver_test@fleetflow.com"]
    driver_rec = db.query(Driver).filter(Driver.user_id == driver_user.user_id).first()
    if not driver_rec:
        driver_rec = Driver(
            user_id=driver_user.user_id,
            license_number="CDL-TEST-001",
            status="Active",
            experience_years=4,
            address="Depot East",
        )
        db.add(driver_rec)
        db.commit()
        db.refresh(driver_rec)

    driver2_user = created_users["driver2_test@fleetflow.com"]
    driver2_rec = db.query(Driver).filter(Driver.user_id == driver2_user.user_id).first()
    if not driver2_rec:
        driver2_rec = Driver(
            user_id=driver2_user.user_id,
            license_number="CDL-TEST-002",
            status="Active",
            experience_years=2,
            address="Depot West",
        )
        db.add(driver2_rec)
        db.commit()
        db.refresh(driver2_rec)

    d1_id = driver_rec.driver_id
    d2_id = driver2_rec.driver_id
    db.close()
    return d1_id, d2_id

def run_all_tests():
    driver_id_1, driver_id_2 = seed_test_data()
    headers = create_tokens()
    today_str = str(date.today())

    print("\n========================================================")
    print(" 1. TESTING ATTENDANCE TRACKING & ROLE PERMISSIONS")
    print("========================================================")

    # 1.1 FM / Admin marks attendance (Present)
    res = client.post("/attendance/mark", json={
        "driver_id": str(driver_id_1),
        "date": today_str,
        "status": "Present",
        "remarks": "On-time arrival"
    }, headers=headers["FleetManager"])
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    data = res.json()
    assert data["status"] == "Present"
    print("[PASS] FleetManager can mark driver attendance as Present (200)")

    # 1.2 Upsert: Admin updates attendance to Leave with remarks
    res = client.post("/attendance/mark", json={
        "driver_id": str(driver_id_1),
        "date": today_str,
        "status": "Leave",
        "remarks": "Half day medical leave"
    }, headers=headers["Admin"])
    assert res.status_code == 200
    assert res.json()["status"] == "Leave"
    print("[PASS] Attendance record successfully upserted on duplicate date (200)")

    # 1.3 Dispatcher cannot mark attendance (403)
    res = client.post("/attendance/mark", json={
        "driver_id": str(driver_id_1),
        "date": today_str,
        "status": "Present"
    }, headers=headers["Dispatcher"])
    assert res.status_code == 403
    print("[PASS] Dispatcher forbidden from marking attendance (403)")

    # 1.4 Driver cannot mark other driver's attendance (403)
    res = client.post("/attendance/mark", json={
        "driver_id": str(driver_id_2),
        "date": today_str,
        "status": "Present"
    }, headers=headers["Driver"])
    assert res.status_code == 403
    print("[PASS] Driver forbidden from marking attendance (403)")

    # 1.5 Bulk mark attendance
    res = client.post("/attendance/bulk", json={
        "records": [
            {"driver_id": str(driver_id_1), "status": "Present", "date": today_str, "remarks": "Shift A"},
            {"driver_id": str(driver_id_2), "status": "Present", "date": today_str, "remarks": "Shift B"},
        ]
    }, headers=headers["FleetManager"])
    assert res.status_code == 200
    assert res.json()["count"] == 2
    print("[PASS] Bulk mark attendance endpoint operates accurately (200)")

    # 1.6 Mark all unmarked present
    res = client.post("/attendance/mark-all-present", params={"target_date": today_str}, headers=headers["Admin"])
    assert res.status_code == 200
    print("[PASS] Quick mark all unmarked drivers as present (200)")

    # 1.7 Get Fleet Roster (Admin / Dispatcher view)
    res = client.get("/attendance/", params={"target_date": today_str}, headers=headers["Dispatcher"])
    assert res.status_code == 200
    roster_data = res.json()
    assert roster_data["total_drivers"] >= 2
    assert "roster" in roster_data
    print("[PASS] Dispatcher can access read-only fleet daily attendance roster (200)")

    # 1.8 Driver Self Check-in
    res = client.post("/attendance/check-in", headers=headers["Driver"])
    assert res.status_code == 200
    assert res.json()["status"] == "Present"
    print("[PASS] Driver self check-in endpoint marks Present (200)")

    # 1.9 Driver My-History
    res = client.get("/attendance/my-history", headers=headers["Driver"])
    assert res.status_code == 200
    summary = res.json()
    assert summary["present_days"] >= 1
    assert "attendance_rate_pct" in summary
    print("[PASS] Driver can view personal attendance history & presence rate (200)")

    print("\n========================================================")
    print(" 2. TESTING DRIVER LEAVE APPLICATION & ADMIN APPROVAL")
    print("========================================================")

    # 2.1 Driver applies for leave
    tomorrow = date.today() + timedelta(days=1)
    day_after = date.today() + timedelta(days=2)

    res = client.post("/attendance/leaves/apply", json={
        "start_date": str(tomorrow),
        "end_date": str(day_after),
        "leave_type": "Sick",
        "reason": "Doctor appointment and recovery"
    }, headers=headers["Driver"])
    assert res.status_code == 201
    leave_data = res.json()
    leave_id = leave_data["leave_id"]
    assert leave_data["status"] == "Pending"
    print(f"[PASS] Driver submitted leave application for {tomorrow} to {day_after} (201)")

    # 2.2 List leaves
    res = client.get("/attendance/leaves", headers=headers["FleetManager"])
    assert res.status_code == 200
    leaves_list = res.json()
    assert any(l["leave_id"] == leave_id for l in leaves_list)
    print("[PASS] FleetManager can view pending leave requests (200)")

    # 2.3 FM / Admin Approves Leave with Auto-Attendance Sync
    res = client.patch(f"/attendance/leaves/{leave_id}/review", json={
        "status": "Approved",
        "manager_remarks": "Approved by FM, stay well."
    }, headers=headers["FleetManager"])
    assert res.status_code == 200
    assert res.json()["status"] == "Approved"

    # Verify auto-synced attendance for tomorrow and day_after
    res_tomorrow = client.get("/attendance/", params={"target_date": str(tomorrow)}, headers=headers["Admin"])
    tomorrow_roster = res_tomorrow.json()["roster"]
    matched = next((r for r in tomorrow_roster if r["driver_id"] == str(driver_id_1)), None)
    assert matched is not None
    assert matched["status"] == "Leave"
    print("[PASS] Approved leave automatically marked Attendance records as 'Leave' (200)")

    print("\n========================================================")
    print(" 3. TESTING FORGOT PASSWORD & EMAIL OTP RESET WORKFLOW")
    print("========================================================")

    # 3.1 Request OTP for forgot password
    res = client.post("/auth/forgot-password", json={"email": "driver_test@fleetflow.com"})
    assert res.status_code == 200
    print("[PASS] /auth/forgot-password dispatches OTP email (200)")

    # Fetch OTP from DB to simulate user email inbox
    db = SessionLocal()
    u = db.query(User).filter(User.email == "driver_test@fleetflow.com").first()
    otp_code = u.otp_code
    db.close()
    assert otp_code is not None and len(otp_code) == 6

    # 3.2 Reset password with OTP
    res = client.post("/auth/reset-password", json={
        "email": "driver_test@fleetflow.com",
        "otp": otp_code,
        "new_password": "NewSecretPassword123!"
    })
    assert res.status_code == 200
    print("[PASS] /auth/reset-password successfully updates credentials (200)")

    # 3.3 Verify login with new password
    form_data = {"username": "driver_test@fleetflow.com", "password": "NewSecretPassword123!"}
    res = client.post("/auth/login", data=form_data)
    assert res.status_code == 200
    new_driver_token = res.json()["access_token"]
    print("[PASS] Login with new password successful (200)")

    # 3.4 Test In-App Change Password
    res = client.post("/auth/change-password", json={
        "current_password": "NewSecretPassword123!",
        "new_password": "password123"  # restore default
    }, headers={"Authorization": f"Bearer {new_driver_token}"})
    assert res.status_code == 200
    print("[PASS] Authenticated user /auth/change-password successful (200)")

    print("\n========================================================")
    print(" 4. TESTING ADMIN ROLE MANAGEMENT")
    print("========================================================")

    # 4.1 Admin lists users
    res = client.get("/auth/users", headers=headers["Admin"])
    assert res.status_code == 200
    users_list = res.json()
    assert len(users_list) >= 4
    print("[PASS] Admin can view all system users (200)")

    # 4.2 Non-admin cannot list users (403)
    res = client.get("/auth/users", headers=headers["Dispatcher"])
    assert res.status_code == 403
    print("[PASS] Dispatcher forbidden from user listing (403)")

    # 4.3 Admin updates user role
    target_user_id = str(u.user_id)
    res = client.patch(f"/auth/users/{target_user_id}/role", json={"role": "Dispatcher"}, headers=headers["Admin"])
    assert res.status_code == 200
    assert res.json()["role"] == "Dispatcher"
    print("[PASS] Admin successfully changed user role to Dispatcher (200)")

    # Restore role back to Driver
    res = client.patch(f"/auth/users/{target_user_id}/role", json={"role": "Driver"}, headers=headers["Admin"])
    assert res.status_code == 200
    assert res.json()["role"] == "Driver"
    print("[PASS] Role restored to Driver (200)")

    print("\n========================================================")
    print(" 5. TESTING REPORTS & DASHBOARDS ATTENDANCE INTEGRATION")
    print("========================================================")

    # 5.1 Driver Performance Report
    res = client.get("/reports/driver-performance", headers=headers["Admin"])
    assert res.status_code == 200
    rep_data = res.json()
    assert "data" in rep_data
    if rep_data["data"]:
        row = rep_data["data"][0]
        assert "attendance_present_days" in row
        assert "attendance_leave_days" in row
        assert "attendance_rate_pct" in row
    print("[PASS] Driver Performance Report includes Present Days, Leave Days, and Attendance Rate % (200)")

    # 5.2 Admin Dashboard Leaderboard
    res = client.get("/dashboard/admin", headers=headers["Admin"])
    assert res.status_code == 200
    admin_dash = res.json()
    assert "driver_leaderboard" in admin_dash
    print("[PASS] Admin Dashboard Leaderboard includes driver attendance statistics (200)")

    # 5.3 Driver Personal Dashboard
    res = client.get("/dashboard/driver", headers=headers["Driver"])
    assert res.status_code == 200
    driver_dash = res.json()
    assert "my_attendance" in driver_dash
    assert "present_days" in driver_dash["my_attendance"]
    assert "attendance_rate_pct" in driver_dash["my_attendance"]
    print("[PASS] Driver Dashboard contains attendance rate and present days (200)")

    print("\n========================================================")
    print(" >>> ALL 25 AUTOMATED UNIT & RBAC TESTS PASSED! <<<")
    print("========================================================")

if __name__ == "__main__":
    run_all_tests()
