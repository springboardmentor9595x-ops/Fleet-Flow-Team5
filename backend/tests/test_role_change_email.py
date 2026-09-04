import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.database import SessionLocal
from app.models.user import User
from app.models.driver import Driver
from app.core.security import hash_password, create_access_token


@pytest.fixture
def setup_role_change_db():
    db = SessionLocal()
    
    # Create Admin user
    admin_user = User(
        email="test_role_admin@fleetflow.com",
        password=hash_password("AdminPassword123!"),
        full_name="Master Admin User",
        role="Admin",
        is_verified=True,
    )
    db.add(admin_user)

    # Create Target Driver user
    target_user = User(
        email="test_role_target@fleetflow.com",
        password=hash_password("DriverPassword123!"),
        full_name="Target Test User",
        role="Driver",
        is_verified=True,
    )
    db.add(target_user)
    db.commit()
    db.refresh(admin_user)
    db.refresh(target_user)

    # Ensure Driver profile
    driver = Driver(user_id=target_user.user_id, status="Active")
    db.add(driver)
    db.commit()

    admin_token = create_access_token(subject=admin_user.email)
    driver_token = create_access_token(subject=target_user.email)

    yield {
        "db": db,
        "admin_user": admin_user,
        "target_user": target_user,
        "admin_headers": {"Authorization": f"Bearer {admin_token}"},
        "driver_headers": {"Authorization": f"Bearer {driver_token}"},
    }

    # Teardown
    db.query(Driver).filter(Driver.user_id == target_user.user_id).delete()
    db.query(User).filter(User.email.in_([admin_user.email, target_user.email])).delete()
    db.commit()
    db.close()


def test_role_change_email_workflow(setup_role_change_db):
    client = TestClient(app, raise_server_exceptions=False)
    admin_headers = setup_role_change_db["admin_headers"]
    driver_headers = setup_role_change_db["driver_headers"]
    target_user = setup_role_change_db["target_user"]
    admin_user = setup_role_change_db["admin_user"]
    user_id_str = str(target_user.user_id)

    with patch("app.routers.users.send_role_change_email") as mock_role_email:
        mock_role_email.return_value = (True, "Email sent successfully")

        # 1. Driver -> Fleet Manager role update (Sends email with previous="Driver", new="Fleet Manager")
        res1 = client.patch(
            f"/users/{user_id_str}/role",
            json={"role": "FleetManager"},
            headers=admin_headers,
        )
        assert res1.status_code == 200
        assert res1.json()["role"] == "FleetManager"

        mock_role_email.assert_called_once()
        kwargs1 = mock_role_email.call_args.kwargs
        assert kwargs1["to_email"] == "test_role_target@fleetflow.com"
        assert kwargs1["to_email"] != admin_user.email
        assert kwargs1["user_name"] == "Target Test User"
        assert kwargs1["previous_role"] == "Driver"
        assert kwargs1["new_role"] == "FleetManager"
        assert kwargs1["changed_by_name"] == "Master Admin User"

        mock_role_email.reset_mock()

        # 2. Fleet Manager -> Driver role update
        res2 = client.patch(
            f"/users/{user_id_str}/role",
            json={"role": "Driver"},
            headers=admin_headers,
        )
        assert res2.status_code == 200
        assert res2.json()["role"] == "Driver"

        mock_role_email.assert_called_once()
        kwargs2 = mock_role_email.call_args.kwargs
        assert kwargs2["to_email"] == "test_role_target@fleetflow.com"
        assert kwargs2["previous_role"] == "FleetManager"
        assert kwargs2["new_role"] == "Driver"

        mock_role_email.reset_mock()

        # 3. Fleet Manager -> Dispatcher role update
        res3 = client.patch(
            f"/users/{user_id_str}/role",
            json={"role": "Dispatcher"},
            headers=admin_headers,
        )
        assert res3.status_code == 200
        assert res3.json()["role"] == "Dispatcher"
        assert mock_role_email.call_args.kwargs["previous_role"] == "Driver"
        assert mock_role_email.call_args.kwargs["new_role"] == "Dispatcher"

        mock_role_email.reset_mock()

        # 4. Same role -> Same role (Dispatcher -> Dispatcher) sends NO email
        res_noop = client.patch(
            f"/users/{user_id_str}/role",
            json={"role": "Dispatcher"},
            headers=admin_headers,
        )
        assert res_noop.status_code == 200
        mock_role_email.assert_not_called()

        # 5. Unauthorized non-admin driver cannot change role
        res_unauth = client.patch(
            f"/users/{user_id_str}/role",
            json={"role": "Admin"},
            headers=driver_headers,
        )
        assert res_unauth.status_code == 403


def test_role_change_smtp_failure_fallback(setup_role_change_db):
    client = TestClient(app, raise_server_exceptions=False)
    admin_headers = setup_role_change_db["admin_headers"]
    target_user = setup_role_change_db["target_user"]
    user_id_str = str(target_user.user_id)

    with patch("app.routers.users.send_role_change_email") as mock_role_email:
        # Mock SMTP exception / failure
        mock_role_email.side_effect = Exception("SMTP Connection Timeout")

        # Update role from Driver to FleetManager
        res = client.patch(
            f"/users/{user_id_str}/role",
            json={"role": "FleetManager"},
            headers=admin_headers,
        )

        # Role change MUST still succeed in DB despite email failure
        assert res.status_code == 200
        assert res.json()["role"] == "FleetManager"

        # Verify DB directly
        db: Session = setup_role_change_db["db"]
        db.refresh(target_user)
        assert target_user.role == "FleetManager"
