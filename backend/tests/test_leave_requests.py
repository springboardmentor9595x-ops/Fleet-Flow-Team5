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
from app.models.trip import Trip
from app.models.attendance import Attendance
from app.models.leave_request import LeaveRequest
from app.core.security import create_access_token, hash_password


@pytest.fixture(scope="module")
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # Clean up test leave requests, attendance, trips, drivers, users
    db.query(LeaveRequest).delete()
    db.query(Attendance).delete()
    db.query(Trip).delete()
    db.query(Driver).delete()
    db.query(User).filter(User.email.like("%test_leave_%")).delete()
    db.commit()

    # Create Admin user
    admin_user = User(
        email="test_leave_admin@fleetflow.com",
        password=hash_password("AdminPass123!"),
        full_name="Leave Test Admin",
        role="Admin",
        is_verified=True,
    )
    db.add(admin_user)

    # Create FleetManager user
    fm_user = User(
        email="test_leave_fm@fleetflow.com",
        password=hash_password("ManagerPass123!"),
        full_name="Leave Test Manager",
        role="FleetManager",
        is_verified=True,
    )
    db.add(fm_user)

    # Create Driver 1
    driver1_user = User(
        email="test_leave_driver1@fleetflow.com",
        password=hash_password("DriverPass123!"),
        full_name="Leave Driver One",
        role="Driver",
        is_verified=True,
    )
    db.add(driver1_user)

    # Create Driver 2
    driver2_user = User(
        email="test_leave_driver2@fleetflow.com",
        password=hash_password("DriverPass123!"),
        full_name="Leave Driver Two",
        role="Driver",
        is_verified=True,
    )
    db.add(driver2_user)
    db.commit()

    d1_profile = Driver(
        user_id=driver1_user.user_id,
        license_number="LIC-LEAVE-001",
        experience_years=5,
        status="Active",
    )
    d2_profile = Driver(
        user_id=driver2_user.user_id,
        license_number="LIC-LEAVE-002",
        experience_years=3,
        status="Active",
    )
    db.add(d1_profile)
    db.add(d2_profile)
    db.commit()

    admin_token = create_access_token(subject=admin_user.email)
    fm_token = create_access_token(subject=fm_user.email)
    driver1_token = create_access_token(subject=driver1_user.email)
    driver2_token = create_access_token(subject=driver2_user.email)

    data = {
        "db": db,
        "admin_user": admin_user,
        "fm_user": fm_user,
        "driver1_user": driver1_user,
        "driver1_profile": d1_profile,
        "driver2_user": driver2_user,
        "driver2_profile": d2_profile,
        "admin_headers": {"Authorization": f"Bearer {admin_token}"},
        "fm_headers": {"Authorization": f"Bearer {fm_token}"},
        "driver1_headers": {"Authorization": f"Bearer {driver1_token}"},
        "driver2_headers": {"Authorization": f"Bearer {driver2_token}"},
    }

    yield data

    # Cleanup after module
    db.query(LeaveRequest).delete()
    db.query(Attendance).delete()
    db.query(Trip).delete()
    db.query(Driver).delete()
    db.query(User).filter(User.email.like("%test_leave_%")).delete()
    db.commit()
    db.close()


def test_leave_workflow_full(setup_db):
    client = TestClient(app, raise_server_exceptions=False)
    d1_headers = setup_db["driver1_headers"]
    d2_headers = setup_db["driver2_headers"]
    admin_headers = setup_db["admin_headers"]
    fm_headers = setup_db["fm_headers"]
    db: Session = setup_db["db"]

    today = date.today()
    start_d = (today + timedelta(days=10)).isoformat()
    end_d = (today + timedelta(days=12)).isoformat()

    # 1. Driver 1 submits leave -> Pending
    res = client.post(
        "/leave-requests/",
        json={
            "leave_type": "Casual Leave",
            "start_date": start_d,
            "end_date": end_d,
            "reason": "Personal family event",
        },
        headers=d1_headers,
    )
    assert res.status_code == 201
    leave_data = res.json()
    assert leave_data["status"] == "Pending"
    assert leave_data["days_count"] == 3
    leave_id = leave_data["leave_id"]

    # 2. Driver sees pending request
    res_driver_list = client.get("/leave-requests/", headers=d1_headers)
    assert res_driver_list.status_code == 200
    driver_requests = res_driver_list.json()
    assert any(r["leave_id"] == leave_id for r in driver_requests)

    # 3. Admin sees pending request
    res_admin_list = client.get("/leave-requests/", headers=admin_headers)
    assert res_admin_list.status_code == 200
    assert any(r["leave_id"] == leave_id for r in res_admin_list.json())

    # 3b. Fleet Manager sees pending request
    res_fm_list = client.get("/leave-requests/", headers=fm_headers)
    assert res_fm_list.status_code == 200
    assert any(r["leave_id"] == leave_id for r in res_fm_list.json())

    # 8. Driver cannot approve their own request (403)
    res_self_approve = client.post(
        f"/leave-requests/{leave_id}/review",
        json={"status": "Approved"},
        headers=d1_headers,
    )
    assert res_self_approve.status_code == 403

    # 8b. Driver cannot reject a request (403)
    res_self_reject = client.post(
        f"/leave-requests/{leave_id}/review",
        json={"status": "Rejected", "rejection_reason": "Not allowed"},
        headers=d1_headers,
    )
    assert res_self_reject.status_code == 403

    # 4. Fleet Manager approves -> Approved
    res_approve = client.post(
        f"/leave-requests/{leave_id}/review",
        json={"status": "Approved"},
        headers=fm_headers,
    )
    assert res_approve.status_code == 200
    assert res_approve.json()["status"] == "Approved"

    # 14. Cannot review an already approved request twice (400)
    res_repeat = client.post(
        f"/leave-requests/{leave_id}/review",
        json={"status": "Approved"},
        headers=admin_headers,
    )
    assert res_repeat.status_code == 400

    # 5. Attendance reflects approved leave
    curr_d = today + timedelta(days=10)
    att_record = db.query(Attendance).filter(
        Attendance.driver_id == setup_db["driver1_profile"].driver_id,
        Attendance.date == curr_d,
    ).first()
    assert att_record is not None
    assert att_record.status == "Leave"

    # Rejection without reason fails (400)
    start_rej_fail = (today + timedelta(days=35)).isoformat()
    end_rej_fail = (today + timedelta(days=36)).isoformat()
    res_sub_rej_fail = client.post(
        "/leave-requests/",
        json={
            "leave_type": "Other",
            "start_date": start_rej_fail,
            "end_date": end_rej_fail,
            "reason": "Testing rejection reason requirement",
        },
        headers=d1_headers,
    )
    rej_fail_id = res_sub_rej_fail.json()["leave_id"]
    res_no_reason = client.post(
        f"/leave-requests/{rej_fail_id}/review",
        json={"status": "Rejected", "rejection_reason": "   "},
        headers=fm_headers,
    )
    assert res_no_reason.status_code == 400
    assert "Rejection reason is required" in res_no_reason.json()["detail"]

    # Fleet Manager rejects leave with valid reason
    res_with_reason = client.post(
        f"/leave-requests/{rej_fail_id}/review",
        json={"status": "Rejected", "rejection_reason": "High fleet workload."},
        headers=fm_headers,
    )
    assert res_with_reason.status_code == 200
    assert res_with_reason.json()["status"] == "Rejected"
    assert res_with_reason.json()["rejection_reason"] == "High fleet workload."

    # Confirm rejected leave does NOT mark Attendance as Leave
    att_rej = db.query(Attendance).filter(
        Attendance.driver_id == setup_db["driver1_profile"].driver_id,
        Attendance.date == today + timedelta(days=35),
    ).first()
    assert att_rej is None or att_rej.status != "Leave"

    # 10. Invalid date range (end date before start date)
    res_invalid_date = client.post(
        "/leave-requests/",
        json={
            "leave_type": "Vacation",
            "start_date": (today + timedelta(days=20)).isoformat(),
            "end_date": (today + timedelta(days=18)).isoformat(),
            "reason": "Invalid dates test",
        },
        headers=d1_headers,
    )
    assert res_invalid_date.status_code == 400
    assert "End date cannot be before start date" in res_invalid_date.json()["detail"]

    # 11. Overlapping leave is rejected
    res_overlap = client.post(
        "/leave-requests/",
        json={
            "leave_type": "Vacation",
            "start_date": (today + timedelta(days=11)).isoformat(),
            "end_date": (today + timedelta(days=15)).isoformat(),
            "reason": "Overlapping dates test",
        },
        headers=d1_headers,
    )
    assert res_overlap.status_code == 400
    assert "already has an approved leave" in res_overlap.json()["detail"]

    # 6 & 7. Admin rejects leave & Rejection reason visible
    start_rej = (today + timedelta(days=40)).isoformat()
    end_rej = (today + timedelta(days=42)).isoformat()
    res_rej_sub = client.post(
        "/leave-requests/",
        json={
            "leave_type": "Other",
            "start_date": start_rej,
            "end_date": end_rej,
            "reason": "Personal time off",
        },
        headers=d1_headers,
    )
    assert res_rej_sub.status_code == 201
    rej_id = res_rej_sub.json()["leave_id"]

    res_reject = client.post(
        f"/leave-requests/{rej_id}/review",
        json={"status": "Rejected", "rejection_reason": "High dispatch workload expected during these dates."},
        headers=admin_headers,
    )
    assert res_reject.status_code == 200
    assert res_reject.json()["status"] == "Rejected"
    assert res_reject.json()["rejection_reason"] == "High dispatch workload expected during these dates."

    # Driver views rejection reason
    res_driver_rej_view = client.get("/leave-requests/", headers=d1_headers)
    rej_item = next(r for r in res_driver_rej_view.json() if r["leave_id"] == rej_id)
    assert rej_item["rejection_reason"] == "High dispatch workload expected during these dates."

    # 12. Trip conflict is handled correctly
    # Add a scheduled trip for Driver 1
    trip_start = today + timedelta(days=50)
    trip = Trip(
        driver_id=setup_db["driver1_profile"].driver_id,
        start_location="Depot A",
        destination="Warehouse B",
        start_time=trip_start,
        end_time=trip_start + timedelta(days=2),
        status="Scheduled",
    )
    db.add(trip)
    db.commit()

    res_trip_conflict = client.post(
        "/leave-requests/",
        json={
            "leave_type": "Vacation",
            "start_date": (trip_start + timedelta(days=1)).isoformat(),
            "end_date": (trip_start + timedelta(days=3)).isoformat(),
            "reason": "Vacation trip conflict",
        },
        headers=d1_headers,
    )
    assert res_trip_conflict.status_code == 400
    assert "conflicting active/scheduled trip" in res_trip_conflict.json()["detail"]

    # 13. Driver can cancel a pending request
    cancel_start = (today + timedelta(days=60)).isoformat()
    cancel_end = (today + timedelta(days=62)).isoformat()
    res_can_sub = client.post(
        "/leave-requests/",
        json={
            "leave_type": "Emergency Leave",
            "start_date": cancel_start,
            "end_date": cancel_end,
            "reason": "Emergency situation",
        },
        headers=d1_headers,
    )
    can_id = res_can_sub.json()["leave_id"]

    res_cancel = client.post(f"/leave-requests/{can_id}/cancel", headers=d1_headers)
    assert res_cancel.status_code == 200
    assert res_cancel.json()["status"] == "Cancelled"

    # 14. Multiple drivers can submit independent requests
    res_d2 = client.post(
        "/leave-requests/",
        json={
            "leave_type": "Sick Leave",
            "start_date": (today + timedelta(days=10)).isoformat(),
            "end_date": (today + timedelta(days=12)).isoformat(),
            "reason": "Driver 2 sick leave",
        },
        headers=d2_headers,
    )
    assert res_d2.status_code == 201
    assert res_d2.json()["driver_id"] == str(setup_db["driver2_profile"].driver_id)


def test_leave_email_notifications(setup_db):
    from unittest.mock import patch

    client = TestClient(app, raise_server_exceptions=False)
    d1_headers = setup_db["driver1_headers"]
    admin_headers = setup_db["admin_headers"]

    today = date.today()
    start_d = (today + timedelta(days=100)).isoformat()
    end_d = (today + timedelta(days=102)).isoformat()

    with patch("app.crud.leave_request.send_leave_approval_email") as mock_approve_email, \
         patch("app.crud.leave_request.send_leave_rejection_email") as mock_reject_email:
        
        mock_approve_email.return_value = (True, "Email sent")
        mock_reject_email.return_value = (True, "Email sent")

        # 1. Driver 1 submits leave -> Pending (No email sent yet)
        res_sub = client.post(
            "/leave-requests/",
            json={
                "leave_type": "Vacation",
                "start_date": start_d,
                "end_date": end_d,
                "reason": "Email test leave",
            },
            headers=d1_headers,
        )
        assert res_sub.status_code == 201
        leave_id = res_sub.json()["leave_id"]

        mock_approve_email.assert_not_called()
        mock_reject_email.assert_not_called()

        # 2. Admin approves request -> Approval email sent to Driver 1 registered email
        res_appr = client.post(
            f"/leave-requests/{leave_id}/review",
            json={"status": "Approved"},
            headers=admin_headers,
        )
        assert res_appr.status_code == 200
        assert res_appr.json()["status"] == "Approved"

        mock_approve_email.assert_called_once()
        call_kwargs = mock_approve_email.call_args.kwargs
        assert call_kwargs["to_email"] == "test_leave_driver1@fleetflow.com"
        assert call_kwargs["driver_name"] == "Leave Driver One"
        assert call_kwargs["leave_type"] == "Vacation"
        assert call_kwargs["days_count"] == 3
        mock_reject_email.assert_not_called()

        mock_approve_email.reset_mock()

        # 3. Repeat review action on already approved request -> No duplicate email sent
        res_repeat = client.post(
            f"/leave-requests/{leave_id}/review",
            json={"status": "Approved"},
            headers=admin_headers,
        )
        assert res_repeat.status_code == 400
        mock_approve_email.assert_not_called()

        # 4. Create second request & reject it -> Rejection email sent with reason
        start_r = (today + timedelta(days=110)).isoformat()
        end_r = (today + timedelta(days=111)).isoformat()
        res_sub2 = client.post(
            "/leave-requests/",
            json={
                "leave_type": "Casual Leave",
                "start_date": start_r,
                "end_date": end_r,
                "reason": "Email test rejection",
            },
            headers=d1_headers,
        )
        assert res_sub2.status_code == 201
        leave_id2 = res_sub2.json()["leave_id"]

        res_rej = client.post(
            f"/leave-requests/{leave_id2}/review",
            json={
                "status": "Rejected",
                "rejection_reason": "High fleet dispatch load.",
            },
            headers=admin_headers,
        )
        assert res_rej.status_code == 200
        assert res_rej.json()["status"] == "Rejected"

        mock_reject_email.assert_called_once()
        rej_kwargs = mock_reject_email.call_args.kwargs
        assert rej_kwargs["to_email"] == "test_leave_driver1@fleetflow.com"
        assert rej_kwargs["rejection_reason"] == "High fleet dispatch load."


def test_driver_profile_auto_healing_and_creation(setup_db):
    client = TestClient(app, raise_server_exceptions=False)
    db: Session = setup_db["db"]

    # 1. Create a user with role="Driver" WITHOUT manually inserting a Driver row
    unlinked_driver_user = User(
        email="test_unlinked_driver@fleetflow.com",
        password=hash_password("Password123!"),
        full_name="Unlinked Driver Test",
        role="Driver",
        is_verified=True,
    )
    db.add(unlinked_driver_user)
    db.commit()

    # Confirm initially no Driver row exists
    initial_d = db.query(Driver).filter(Driver.user_id == unlinked_driver_user.user_id).first()
    assert initial_d is None

    # Authenticate as unlinked driver
    token = create_access_token(subject=unlinked_driver_user.email)
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Submit leave request -> system auto-heals and creates linked Driver profile
    today = date.today()
    res = client.post(
        "/leave-requests/",
        json={
            "leave_type": "Emergency Leave",
            "start_date": (today + timedelta(days=200)).isoformat(),
            "end_date": (today + timedelta(days=201)).isoformat(),
            "reason": "Emergency leave for auto-healed driver",
        },
        headers=headers,
    )
    assert res.status_code == 201
    leave_data = res.json()
    assert leave_data["status"] == "Pending"

    # 3. Confirm Driver profile was created and correctly linked
    healed_d = db.query(Driver).filter(Driver.user_id == unlinked_driver_user.user_id).first()
    assert healed_d is not None
    assert leave_data["driver_id"] == str(healed_d.driver_id)

    # 4. Confirm no duplicate Driver records are created on subsequent requests
    driver_count = db.query(Driver).filter(Driver.user_id == unlinked_driver_user.user_id).count()
    assert driver_count == 1

    # Cleanup
    db.query(LeaveRequest).filter(LeaveRequest.driver_id == healed_d.driver_id).delete()
    db.query(Driver).filter(Driver.driver_id == healed_d.driver_id).delete()
    db.query(User).filter(User.user_id == unlinked_driver_user.user_id).delete()
    db.commit()


def test_four_roles_leave_permissions(setup_db):
    client = TestClient(app, raise_server_exceptions=False)
    db: Session = setup_db["db"]

    # 1. Create Dispatcher user
    disp_user = User(
        email="test_leave_disp@fleetflow.com",
        password=hash_password("DispPass123!"),
        full_name="Leave Dispatcher User",
        role="Dispatcher",
        is_verified=True,
    )
    db.add(disp_user)
    db.commit()

    disp_token = create_access_token(subject=disp_user.email)
    disp_headers = {"Authorization": f"Bearer {disp_token}"}
    admin_headers = setup_db["admin_headers"]
    fm_headers = setup_db["fm_headers"]
    d1_headers = setup_db["driver1_headers"]
    d2_headers = setup_db["driver2_headers"]

    today = date.today()
    start_d = (today + timedelta(days=300)).isoformat()
    end_d = (today + timedelta(days=302)).isoformat()

    # Driver 1 submits leave request
    res_sub = client.post(
        "/leave-requests/",
        json={
            "leave_type": "Casual Leave",
            "start_date": start_d,
            "end_date": end_d,
            "reason": "4-Role Permission Test",
        },
        headers=d1_headers,
    )
    assert res_sub.status_code == 201
    leave_id = res_sub.json()["leave_id"]

    # --- DISPATCHER PERMISSIONS ---
    # Dispatcher CAN view all leave requests (for planning)
    res_disp_get = client.get("/leave-requests/", headers=disp_headers)
    assert res_disp_get.status_code == 200
    assert any(r["leave_id"] == leave_id for r in res_disp_get.json())

    # Dispatcher CANNOT approve leave request -> 403 Forbidden
    res_disp_appr = client.post(
        f"/leave-requests/{leave_id}/review",
        json={"status": "Approved"},
        headers=disp_headers,
    )
    assert res_disp_appr.status_code == 403

    # Dispatcher CANNOT reject leave request -> 403 Forbidden
    res_disp_rej = client.post(
        f"/leave-requests/{leave_id}/review",
        json={"status": "Rejected", "rejection_reason": "Disp reject"},
        headers=disp_headers,
    )
    assert res_disp_rej.status_code == 403

    # Dispatcher CANNOT submit leave request -> 403 Forbidden
    res_disp_sub = client.post(
        "/leave-requests/",
        json={
            "leave_type": "Casual Leave",
            "start_date": start_d,
            "end_date": end_d,
            "reason": "Dispatcher submit attempt",
        },
        headers=disp_headers,
    )
    assert res_disp_sub.status_code == 403

    # Dispatcher CANNOT cancel leave request -> 403 Forbidden
    res_disp_can = client.post(f"/leave-requests/{leave_id}/cancel", headers=disp_headers)
    assert res_disp_can.status_code == 403

    # --- DRIVER PRIVACY & PERMISSIONS ---
    # Driver attempting to submit with another driver's ID parameter -> backend ignores parameter and assigns to Driver 1
    driver2_id = setup_db["driver2_profile"].driver_id
    tamper_start = (today + timedelta(days=305)).isoformat()
    tamper_end = (today + timedelta(days=306)).isoformat()
    res_tamper = client.post(
        f"/leave-requests/?driver_id={driver2_id}",
        json={
            "leave_type": "Sick Leave",
            "start_date": tamper_start,
            "end_date": tamper_end,
            "reason": "Tamper attempt",
        },
        headers=d1_headers,
    )
    assert res_tamper.status_code == 201
    # Backend MUST resolve to Driver 1, NOT Driver 2
    assert res_tamper.json()["driver_id"] == str(setup_db["driver1_profile"].driver_id)
    assert res_tamper.json()["driver_id"] != str(driver2_id)

    # Driver CANNOT view other driver's requests via driver specific endpoint -> 403 Forbidden
    res_d1_view_d2 = client.get(f"/leave-requests/driver/{driver2_id}", headers=d1_headers)
    assert res_d1_view_d2.status_code == 403

    # Driver CANNOT approve -> 403 Forbidden
    res_d_appr = client.post(
        f"/leave-requests/{leave_id}/review",
        json={"status": "Approved"},
        headers=d1_headers,
    )
    assert res_d_appr.status_code == 403

    # --- FLEET MANAGER PERMISSIONS ---
    # Fleet Manager CAN approve leave request -> 200 OK
    res_fm_appr = client.post(
        f"/leave-requests/{leave_id}/review",
        json={"status": "Approved"},
        headers=fm_headers,
    )
    assert res_fm_appr.status_code == 200
    assert res_fm_appr.json()["status"] == "Approved"

    # --- ADMIN PERMISSIONS ---
    # Create another request for Admin rejection test
    start_d2 = (today + timedelta(days=310)).isoformat()
    end_d2 = (today + timedelta(days=312)).isoformat()
    res_sub2 = client.post(
        "/leave-requests/",
        json={
            "leave_type": "Vacation",
            "start_date": start_d2,
            "end_date": end_d2,
            "reason": "Admin test request",
        },
        headers=d2_headers,
    )
    assert res_sub2.status_code == 201
    leave_id2 = res_sub2.json()["leave_id"]

    # Admin CAN reject leave request -> 200 OK
    res_admin_rej = client.post(
        f"/leave-requests/{leave_id2}/review",
        json={"status": "Rejected", "rejection_reason": "Peak seasonal load."},
        headers=admin_headers,
    )
    assert res_admin_rej.status_code == 200
    assert res_admin_rej.json()["status"] == "Rejected"

    # Cleanup Dispatcher user
    db.query(User).filter(User.user_id == disp_user.user_id).delete()
    db.commit()



