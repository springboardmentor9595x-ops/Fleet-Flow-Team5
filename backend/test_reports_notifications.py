"""
Comprehensive Test Suite for:
1. Notifications Module (fetch, mark-as-read, mark-all-as-read, email dispatch)
2. Reports & Analytics Backend Endpoints (all 5 report types)
3. Role-Based Scoping & Gating for Reports (Admin, FleetManager, Dispatcher, Driver)
4. PDF and Excel Export Functionality
"""
from datetime import date, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.user import User, RoleEnum
from app.models.vehicle import Vehicle
from app.models.driver import Driver
from app.models.notification import Notification
from app.core.security import hash_password, create_access_token
from app.core.email import send_notification_email, get_email_logs

client = TestClient(app)


def setup_users():
    db = SessionLocal()
    users_data = [
        ("admin_rep@fleetflow.com", "Admin Tester", RoleEnum.Admin),
        ("fm_rep@fleetflow.com", "FleetMgr Tester", RoleEnum.FleetManager),
        ("disp_rep@fleetflow.com", "Dispatcher Tester", RoleEnum.Dispatcher),
        ("driver_rep@fleetflow.com", "Driver Tester", RoleEnum.Driver),
    ]
    tokens = {}
    for email, name, role in users_data:
        u = db.query(User).filter(User.email == email).first()
        if not u:
            u = User(
                email=email,
                full_name=name,
                password=hash_password("password123"),
                role=role,
            )
            db.add(u)
            db.commit()
            db.refresh(u)

        if role == RoleEnum.Driver:
            d = db.query(Driver).filter(Driver.user_id == u.user_id).first()
            if not d:
                d = Driver(
                    user_id=u.user_id,
                    license_number="LIC-REP-01",
                    experience_years=5,
                )
                db.add(d)
                db.commit()

        tok = create_access_token({"sub": email, "role": role.value})
        tokens[role.value] = {"Authorization": f"Bearer {tok}"}

    db.close()
    return tokens


def run_tests():
    tokens = setup_users()
    db = SessionLocal()

    print("=== 1. Testing Notification Module & Email Logging ===")
    admin_user = db.query(User).filter(User.email == "admin_rep@fleetflow.com").first()

    # Create a test notification for admin
    notif = Notification(
        user_id=admin_user.user_id,
        title="Urgent Test Alert",
        message="Critical shipment test message",
        type="MAINTENANCE_DUE_TODAY",
        is_read=False,
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)

    # Test GET /notifications/
    res = client.get("/notifications/", headers=tokens["Admin"])
    assert res.status_code == 200
    notifs = res.json()
    assert len(notifs) >= 1
    print(f"[PASS] GET /notifications/ fetched {len(notifs)} notification(s)")

    # Test PUT /notifications/{id}/read
    res_read = client.put(f"/notifications/{notif.notification_id}/read", headers=tokens["Admin"])
    assert res_read.status_code == 200
    assert res_read.json()["is_read"] is True
    print("[PASS] PUT /notifications/{id}/read successfully marked notification as read")

    # Test PUT /notifications/read-all
    res_all = client.put("/notifications/read-all", headers=tokens["Admin"])
    assert res_all.status_code == 200
    print("[PASS] PUT /notifications/read-all successfully marked all as read")

    # Test email sending helper & logs
    send_notification_email(
        recipient_email="admin_rep@fleetflow.com",
        recipient_name="Admin Tester",
        role="Admin",
        title="Test Email Dispatch",
        message="Checking email audit logger",
    )
    email_logs = get_email_logs()
    assert len(email_logs) > 0
    assert any("Test Email Dispatch" in l["subject"] for l in email_logs)
    print(f"[PASS] Notification email logged into audit log ({len(email_logs)} total emails logged)")


    print("\n=== 2. Testing Reports Endpoints (Admin Access) ===")
    today = str(date.today())
    past = str(date.today() - timedelta(days=30))

    # 1. Fleet Utilization
    res = client.get(f"/reports/fleet-utilization?start_date={past}&end_date={today}", headers=tokens["Admin"])
    assert res.status_code == 200
    data = res.json()
    assert "utilization_rate" in data
    print(f"[PASS] Fleet Utilization Report generated (Utilization rate: {data['utilization_rate']}%)")

    # 2. Fuel Consumption
    res = client.get(f"/reports/fuel-consumption?start_date={past}&end_date={today}", headers=tokens["Admin"])
    assert res.status_code == 200
    data = res.json()
    assert "total_fuel_cost" in data
    print(f"[PASS] Fuel Consumption Report generated (Total Cost: ${data['total_fuel_cost']})")

    # 3. Driver Performance
    res = client.get(f"/reports/driver-performance?start_date={past}&end_date={today}", headers=tokens["Admin"])
    assert res.status_code == 200
    data = res.json()
    assert "overall_completion_rate" in data
    print(f"[PASS] Driver Performance Report generated (Completion rate: {data['overall_completion_rate']}%)")

    # 4. Delivery Performance
    res = client.get(f"/reports/delivery-performance?start_date={past}&end_date={today}", headers=tokens["Admin"])
    assert res.status_code == 200
    data = res.json()
    assert "on_time_delivery_rate_pct" in data
    print(f"[PASS] Delivery Performance Report generated (On-time: {data['on_time_delivery_rate_pct']}%)")

    # 5. Maintenance Report
    res = client.get(f"/reports/maintenance?start_date={past}&end_date={today}", headers=tokens["Admin"])
    assert res.status_code == 200
    data = res.json()
    assert "total_maintenance_expense" in data
    print(f"[PASS] Maintenance Report generated (Total Expense: ${data['total_maintenance_expense']})")


    print("\n=== 3. Testing RBAC Scoping on Reports ===")
    # Fleet Manager has access to reports
    res_fm = client.get("/reports/fleet-utilization", headers=tokens["FleetManager"])
    assert res_fm.status_code == 200
    print("[PASS] FleetManager can access reports (200)")

    # Dispatcher: Delivery Performance ONLY
    res_disp_ok = client.get("/reports/delivery-performance", headers=tokens["Dispatcher"])
    assert res_disp_ok.status_code == 200
    print("[PASS] Dispatcher can access Delivery Performance Report (200)")

    res_disp_blocked = client.get("/reports/fuel-consumption", headers=tokens["Dispatcher"])
    assert res_disp_blocked.status_code == 403
    print("[PASS] Dispatcher blocked from Fuel Consumption Report (403)")

    res_disp_blocked2 = client.get("/reports/maintenance", headers=tokens["Dispatcher"])
    assert res_disp_blocked2.status_code == 403
    print("[PASS] Dispatcher blocked from Maintenance Report (403)")

    # Driver: Driver Performance Summary ONLY
    res_drv_ok = client.get("/reports/driver-performance", headers=tokens["Driver"])
    assert res_drv_ok.status_code == 200
    print("[PASS] Driver can access own Driver Performance Report (200)")

    res_drv_blocked = client.get("/reports/fleet-utilization", headers=tokens["Driver"])
    assert res_drv_blocked.status_code == 403
    print("[PASS] Driver blocked from Fleet Utilization Report (403)")


    print("\n=== 4. Testing PDF & Excel Exports ===")
    # PDF Export
    res_pdf = client.get("/reports/export/pdf?report_type=fleet-utilization", headers=tokens["Admin"])
    assert res_pdf.status_code == 200
    assert res_pdf.headers["content-type"] == "application/pdf"
    assert res_pdf.content[:4] == b"%PDF"
    print(f"[PASS] PDF Export generated valid PDF file ({len(res_pdf.content)} bytes)")

    # Excel Export
    res_excel = client.get("/reports/export/excel?report_type=delivery-performance", headers=tokens["Admin"])
    assert res_excel.status_code == 200
    assert "spreadsheetml" in res_excel.headers["content-type"]
    assert res_excel.content[:2] == b"PK"  # Zip/Office Open XML header
    print(f"[PASS] Excel Export generated valid XLSX file ({len(res_excel.content)} bytes)")

    # RBAC on PDF Export (Dispatcher blocked from exporting maintenance PDF)
    res_pdf_blocked = client.get("/reports/export/pdf?report_type=maintenance", headers=tokens["Dispatcher"])
    assert res_pdf_blocked.status_code == 403
    print("[PASS] RBAC enforced on PDF Export (Dispatcher blocked from maintenance PDF - 403)")

    db.close()
    print("\nALL NOTIFICATIONS, REPORTS, RBAC & EXPORT TESTS PASSED SUCCESSFULLY!")


if __name__ == "__main__":
    run_tests()
