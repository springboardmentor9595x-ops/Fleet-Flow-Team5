import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_root():
    response = client.get("/")
    assert response.status_code == 200
    assert "FleetFlow" in response.json()["message"]


from unittest.mock import patch

@patch("app.routers.auth.send_verification_email", return_value=(True, "Email sent successfully"))
def test_auth_and_rbac_flow(mock_send):
    # Track created IDs for teardown
    created_shipment_id = None
    created_trip_id = None
    created_vehicle_id = None

    try:
        # 1. Sign up Admin
        admin_email = f"admin_{int(datetime.now().timestamp())}@fleetflow.com"
        admin_payload = {
            "full_name": "Admin Tester",
            "email": admin_email,
            "password": "Password123!",
            "role": "Admin",
            "phone": "+1234567890",
        }
        signup_res = client.post("/auth/signup", json=admin_payload)
        assert signup_res.status_code == 201, signup_res.text

        # Verify admin in DB and set role to Admin
        from app.database import SessionLocal
        from app.models.user import User
        with SessionLocal() as db:
            db.query(User).filter(User.email == admin_email).update({"is_verified": True, "role": "Admin"})
            db.commit()

        # 2. Login Admin
        login_res = client.post(
            "/auth/login",
            data={"username": admin_email, "password": "Password123!"},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        assert login_res.status_code == 200
        admin_token = login_res.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        # 3. Test /auth/me
        me_res = client.get("/auth/me", headers=admin_headers)
        assert me_res.status_code == 200
        assert me_res.json()["email"] == admin_email
        assert me_res.json()["role"] == "Admin"

        # 4. Sign up Driver (Verifies public signup always assigns role="Driver")
        driver_email = f"driver_{int(datetime.now().timestamp())}@fleetflow.com"
        driver_payload = {
            "full_name": "Driver Tester",
            "email": driver_email,
            "password": "Password123!",
            "role": "Admin",  # Attempting privilege escalation to Admin via signup payload
            "phone": "+1234567891",
        }
        signup_driver_res = client.post("/auth/signup", json=driver_payload)
        assert signup_driver_res.status_code == 201
        assert signup_driver_res.json()["user"]["role"] == "Driver", "Signup must ignore requested Admin role and force Driver"

        with SessionLocal() as db:
            user_obj = db.query(User).filter(User.email == driver_email).first()
            user_obj.is_verified = True
            db.add(user_obj)
            from app.crud.driver import get_driver_by_user_id
            driver_obj = get_driver_by_user_id(db, user_obj.user_id, auto_create=True)
            target_driver_id = str(driver_obj.driver_id)
            db.commit()

        login_driver_res = client.post(
            "/auth/login",
            data={"username": driver_email, "password": "Password123!"},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        assert login_driver_res.status_code == 200
        driver_token = login_driver_res.json()["access_token"]
        driver_headers = {"Authorization": f"Bearer {driver_token}"}

        # 5. Test RBAC: Driver cannot create vehicle or shipment (403 Forbidden)
        vehicle_payload = {
            "registration_number": f"TEST-{int(datetime.now().timestamp()) % 10000}",
            "vehicle_type": "Semi-Truck",
            "brand": "Volvo",
            "model": "VNL 860",
            "manufacture_year": 2023,
            "fuel_type": "Diesel",
            "capacity": 25000,
            "status": "Available",
        }
        driver_vehicle_res = client.post("/vehicles/", json=vehicle_payload, headers=driver_headers)
        assert driver_vehicle_res.status_code == 403

        # Test Driver cannot create shipment (403 Forbidden)
        test_shipment_payload = {
            "source": "San Francisco",
            "destination": "San Jose",
            "customer_name": "Acme Logistics",
            "customer_phone": "555-0199",
            "shipment_weight": 450.0,
            "driver_id": target_driver_id,
        }
        driver_shipment_res = client.post("/shipments/", json=test_shipment_payload, headers=driver_headers)
        assert driver_shipment_res.status_code == 403

        # 6. Admin CAN create vehicle (201 Created)
        admin_vehicle_res = client.post("/vehicles/", json=vehicle_payload, headers=admin_headers)
        assert admin_vehicle_res.status_code == 201
        vehicle_data = admin_vehicle_res.json()
        vehicle_id = vehicle_data["vehicle_id"]
        created_vehicle_id = vehicle_id

        # 7. Check Vehicle Stats (Restricted to Admin, FleetManager; Driver gets 403)
        driver_stats_res = client.get("/vehicles/stats/summary", headers=driver_headers)
        assert driver_stats_res.status_code == 403

        admin_stats_res = client.get("/vehicles/stats/summary", headers=admin_headers)
        assert admin_stats_res.status_code == 200
        assert admin_stats_res.json()["total"] >= 1

        # Check Delayed alerts (Driver gets 403)
        driver_alerts_res = client.get("/shipments/alerts/delayed", headers=driver_headers)
        assert driver_alerts_res.status_code == 403

        # Check Fleet-wide live tracking (Driver gets 200)
        driver_loc_res = client.get("/realtime/latest-locations", headers=driver_headers)
        assert driver_loc_res.status_code == 200

        # 8. Create Shipment (Admin allowed)
        shipment_payload = {
            "source": "San Francisco",
            "destination": "San Jose",
            "customer_name": "Acme Logistics",
            "customer_phone": "555-0199",
            "shipment_weight": 450.0,
            "vehicle_id": vehicle_id,
            "driver_id": target_driver_id,
            "expected_delivery_time": (datetime.now(timezone.utc) + timedelta(hours=4)).isoformat(),
            "notes": "Fragile electronic cargo",
        }
        shipment_res = client.post("/shipments/", json=shipment_payload, headers=admin_headers)
        assert shipment_res.status_code == 201
        shipment_data = shipment_res.json()
        shipment_id = shipment_data["shipment_id"]
        created_shipment_id = shipment_id
        tracking_number = shipment_data["tracking_number"]
        assert tracking_number.startswith("TRK-")
        assert shipment_data["status"] == "Assigned"

        # Non-admin / Non-dispatcher Driver cannot update shipment status (403 Forbidden)
        driver_update_status_res = client.patch(
            f"/shipments/{shipment_id}/status",
            json={"status": "In Transit"},
            headers=driver_headers,
        )
        assert driver_update_status_res.status_code == 403

        # Driver cannot schedule trip (403 Forbidden)
        test_trip_payload = {
            "shipment_id": shipment_id,
            "vehicle_id": vehicle_id,
            "start_location": "San Francisco",
            "destination": "San Jose",
            "route_type": "fastest",
        }
        driver_trip_res = client.post("/trips/", json=test_trip_payload, headers=driver_headers)
        assert driver_trip_res.status_code == 403

        # 9. Track shipment by number (Public endpoint)
        track_res = client.get(f"/shipments/tracking/{tracking_number}")
        assert track_res.status_code == 200
        assert track_res.json()["shipment_id"] == shipment_id

        # 10. Test Route Calculation Options
        calc_res = client.post(
            "/trips/calculate-routes",
            json={"source": "San Francisco", "destination": "San Jose"},
            headers=admin_headers,
        )
        assert calc_res.status_code == 200
        routes_data = calc_res.json()["routes"]
        assert len(routes_data) == 4

        # 11. Schedule Trip (Admin)
        trip_payload = {
            "shipment_id": shipment_id,
            "vehicle_id": vehicle_id,
            "start_location": "San Francisco",
            "destination": "San Jose",
            "route_type": "fastest",
        }
        trip_res = client.post("/trips/", json=trip_payload, headers=admin_headers)
        assert trip_res.status_code == 201
        trip_data = trip_res.json()
        trip_id = trip_data["trip_id"]
        created_trip_id = trip_id
        assert trip_data["status"] == "Scheduled"

        # 12. Start Trip (Admin can start any trip)
        start_res = client.post(f"/trips/{trip_id}/start", headers=admin_headers)
        assert start_res.status_code == 200
        assert start_res.json()["status"] == "In Transit"

        # Verify vehicle status is now In Transit
        veh_check = client.get(f"/vehicles/{vehicle_id}", headers=admin_headers)
        assert veh_check.json()["status"] == "In Transit"

        # 13. Ingest GPS Ping
        ping_res = client.post(
            "/realtime/simulate-ping",
            json={
                "vehicle_id": vehicle_id,
                "shipment_id": shipment_id,
                "trip_id": trip_id,
                "latitude": 37.5585,
                "longitude": -122.2711,
                "speed": 65.0,
                "heading": 135.0,
            },
            headers=admin_headers,
        )
        assert ping_res.status_code == 200

        # 14. End Trip (Admin)
        end_res = client.post(f"/trips/{trip_id}/end", headers=admin_headers)
        assert end_res.status_code == 200
        assert end_res.json()["status"] == "Completed"

        # Verify shipment is now Delivered and vehicle is Available
        shipment_check = client.get(f"/shipments/{shipment_id}", headers=admin_headers)
        assert shipment_check.json()["status"] == "Delivered"

        veh_free_check = client.get(f"/vehicles/{vehicle_id}", headers=admin_headers)
        assert veh_free_check.json()["status"] == "Available"

        print("ALL BACKEND RBAC AND WORKFLOW TESTS PASSED SUCCESSFULLY!")

    finally:
        # Automated Teardown: Remove test records so tests don't leave demo data in database
        from app.database import SessionLocal
        from app.models.shipment import Shipment
        from app.models.trip import Trip
        from app.models.vehicle import Vehicle
        from app.models.gps_tracking import GPSTracking
        from app.models.driver import Driver
        from app.models.user import User

        with SessionLocal() as db:
            try:
                if created_trip_id:
                    db.query(Trip).filter(Trip.trip_id == created_trip_id).delete()
                if created_shipment_id:
                    db.query(Shipment).filter(Shipment.shipment_id == created_shipment_id).delete()
                if created_vehicle_id:
                    db.query(GPSTracking).filter(GPSTracking.vehicle_id == created_vehicle_id).delete()
                    db.query(Vehicle).filter(Vehicle.vehicle_id == created_vehicle_id).delete()
                
                # Clean test users
                admin_u = db.query(User).filter(User.email == admin_email).first()
                if admin_u:
                    db.query(User).filter(User.user_id == admin_u.user_id).delete()
                
                driver_u = db.query(User).filter(User.email == driver_email).first()
                if driver_u:
                    db.query(Driver).filter(Driver.user_id == driver_u.user_id).delete()
                    db.query(User).filter(User.user_id == driver_u.user_id).delete()

                db.commit()
            except Exception:
                db.rollback()


if __name__ == "__main__":
    test_root()
    test_auth_and_rbac_flow()
