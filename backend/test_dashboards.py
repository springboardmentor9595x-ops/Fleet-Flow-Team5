"""
Comprehensive Test Suite for 4-Role Dashboard Endpoints:
1. Fleet Dashboard (Admin, FleetManager)
2. Logistics Dashboard (Admin, FleetManager, Dispatcher)
3. Admin Executive Dashboard (Admin only)
4. Driver Personal Dashboard (Driver only)
"""
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.user import User, RoleEnum
from app.models.driver import Driver
from app.models.vehicle import Vehicle
from app.core.security import hash_password, create_access_token

client = TestClient(app)

def setup_users():
    db = SessionLocal()
    users_data = [
        ("admin_dash@fleetflow.com", "Admin Tester", RoleEnum.Admin),
        ("fm_dash@fleetflow.com", "FleetMgr Tester", RoleEnum.FleetManager),
        ("disp_dash@fleetflow.com", "Dispatcher Tester", RoleEnum.Dispatcher),
        ("driver_dash@fleetflow.com", "Driver Tester", RoleEnum.Driver),
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
                    license_number="LIC-DASH-01",
                    experience_years=4,
                )
                db.add(d)
                db.commit()

        tok = create_access_token({"sub": email, "role": role.value})
        tokens[role.value] = {"Authorization": f"Bearer {tok}"}

    db.close()
    return tokens

def run_tests():
    tokens = setup_users()

    print("=== 1. Testing Fleet Dashboard (/dashboard/fleet) ===")
    res = client.get("/dashboard/fleet", headers=tokens["Admin"])
    assert res.status_code == 200
    data = res.json()
    assert "active_vehicles_count" in data
    assert "utilization_pct" in data
    assert "fuel_summary" in data
    assert "maintenance_summary" in data
    print(f"[PASS] Admin accessed Fleet Dashboard (Utilization: {data['utilization_pct']}%)")

    res_fm = client.get("/dashboard/fleet", headers=tokens["FleetManager"])
    assert res_fm.status_code == 200
    print("[PASS] FleetManager accessed Fleet Dashboard (200)")

    res_disp_block = client.get("/dashboard/fleet", headers=tokens["Dispatcher"])
    assert res_disp_block.status_code == 403
    print("[PASS] Dispatcher blocked from Fleet Dashboard (403)")

    res_drv_block = client.get("/dashboard/fleet", headers=tokens["Driver"])
    assert res_drv_block.status_code == 403
    print("[PASS] Driver blocked from Fleet Dashboard (403)")


    print("\n=== 2. Testing Logistics Dashboard (/dashboard/logistics) ===")
    res_log = client.get("/dashboard/logistics", headers=tokens["Dispatcher"])
    assert res_log.status_code == 200
    log_data = res_log.json()
    assert "active_shipments_count" in log_data
    assert "on_time_delivery_rate" in log_data
    assert "live_tracking_snapshot" in log_data
    assert "route_performance" in log_data
    print(f"[PASS] Dispatcher accessed Logistics Dashboard (Active shipments: {log_data['active_shipments_count']})")

    res_fm_log = client.get("/dashboard/logistics", headers=tokens["FleetManager"])
    assert res_fm_log.status_code == 200
    print("[PASS] FleetManager accessed Logistics Dashboard (200)")

    res_drv_log_block = client.get("/dashboard/logistics", headers=tokens["Driver"])
    assert res_drv_log_block.status_code == 403
    print("[PASS] Driver blocked from Logistics Dashboard (403)")


    print("\n=== 3. Testing Admin Executive Dashboard (/dashboard/admin) ===")
    res_adm = client.get("/dashboard/admin", headers=tokens["Admin"])
    assert res_adm.status_code == 200
    adm_data = res_adm.json()
    assert "driver_leaderboard" in adm_data
    assert "operational_kpis" in adm_data
    assert "attention_shipments" in adm_data
    assert "system_monitoring" in adm_data
    print(f"[PASS] Admin accessed Executive Dashboard (Drivers in leaderboard: {len(adm_data['driver_leaderboard'])})")

    res_fm_adm_block = client.get("/dashboard/admin", headers=tokens["FleetManager"])
    assert res_fm_adm_block.status_code == 403
    print("[PASS] FleetManager blocked from Admin Dashboard (403)")

    res_disp_adm_block = client.get("/dashboard/admin", headers=tokens["Dispatcher"])
    assert res_disp_adm_block.status_code == 403
    print("[PASS] Dispatcher blocked from Admin Dashboard (403)")


    print("\n=== 4. Testing Driver Personal Dashboard (/dashboard/driver) ===")
    res_drv = client.get("/dashboard/driver", headers=tokens["Driver"])
    assert res_drv.status_code == 200
    drv_data = res_drv.json()
    assert "my_performance" in drv_data
    assert "my_attendance" in drv_data
    assert "vehicle_maintenance_status" in drv_data
    print(f"[PASS] Driver accessed Personal Dashboard (Driver: {drv_data['driver_name']})")

    res_adm_drv_block = client.get("/dashboard/driver", headers=tokens["Admin"])
    assert res_adm_drv_block.status_code == 403
    print("[PASS] Admin blocked from Driver Dashboard (403)")

    print("\nALL 4-ROLE DASHBOARD TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_tests()
