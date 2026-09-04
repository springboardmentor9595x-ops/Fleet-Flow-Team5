import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.user import User

client = TestClient(app)


from unittest.mock import patch

def test_login_case_1_empty_email():
    res = client.post(
        "/auth/login",
        data={"username": "", "password": "AnyPassword123!"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert res.status_code == 400
    assert res.json()["detail"] == "Email address is required."


def test_login_case_2_invalid_email_format():
    invalid_emails = ["notanemail", "user@", "user@domain", "@domain.com"]
    for email in invalid_emails:
        res = client.post(
            "/auth/login",
            data={"username": email, "password": "AnyPassword123!"},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        assert res.status_code == 400
        assert res.json()["detail"] == "Please enter a valid email address."


def test_login_case_3_empty_password():
    res = client.post(
        "/auth/login",
        data={"username": "driver@fleetflow.com", "password": ""},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert res.status_code == 400
    assert res.json()["detail"] == "Password is required."


def test_login_case_4_nonexistent_email():
    res = client.post(
        "/auth/login",
        data={"username": "nonexistent_99999@fleetflow.com", "password": "AnyPassword123!"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert res.status_code == 401
    assert res.json()["detail"] == "Invalid email or password."


@patch("app.routers.auth.send_verification_email", return_value=(True, "Email sent successfully"))
def test_login_case_5_existing_email_wrong_password(mock_send):
    # Use existing seeded user or create a temporary one
    unique_suffix = int(datetime.now().timestamp() * 1000)
    email = f"case5_{unique_suffix}@fleetflow.com"
    password = "CorrectPassword123!"

    try:
        # Signup
        signup_res = client.post(
            "/auth/signup",
            json={"full_name": "Case 5 Tester", "email": email, "password": password, "role": "Driver"},
        )
        assert signup_res.status_code == 201

        # Login with WRONG password
        res = client.post(
            "/auth/login",
            data={"username": email, "password": "WrongPassword999!"},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        assert res.status_code == 401
        assert res.json()["detail"] == "Invalid email or password."
    finally:
        with SessionLocal() as db:
            from app.models.driver import Driver
            from app.models.email_verification import EmailVerificationToken
            u = db.query(User).filter(User.email == email).first()
            if u:
                db.query(Driver).filter(Driver.user_id == u.user_id).delete()
                db.query(EmailVerificationToken).filter(EmailVerificationToken.user_id == u.user_id).delete()
                db.delete(u)
                db.commit()


@patch("app.routers.auth.send_verification_email", return_value=(True, "Email sent successfully"))
def test_login_case_6_existing_email_unverified(mock_send):
    unique_suffix = int(datetime.now().timestamp() * 1000)
    email = f"case6_{unique_suffix}@fleetflow.com"
    password = "CorrectPassword123!"

    try:
        # Signup -> is_verified is False
        signup_res = client.post(
            "/auth/signup",
            json={"full_name": "Case 6 Tester", "email": email, "password": password, "role": "Driver"},
        )
        assert signup_res.status_code == 201

        # Login with CORRECT password but UNVERIFIED
        res = client.post(
            "/auth/login",
            data={"username": email, "password": password},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        assert res.status_code == 403
        assert res.json()["detail"] == "Verify your email address before logging in."
    finally:
        with SessionLocal() as db:
            from app.models.driver import Driver
            from app.models.email_verification import EmailVerificationToken
            u = db.query(User).filter(User.email == email).first()
            if u:
                db.query(Driver).filter(Driver.user_id == u.user_id).delete()
                db.query(EmailVerificationToken).filter(EmailVerificationToken.user_id == u.user_id).delete()
                db.delete(u)
                db.commit()


@patch("app.routers.auth.send_verification_email", return_value=(True, "Email sent successfully"))
def test_login_case_7_existing_email_verified(mock_send):
    unique_suffix = int(datetime.now().timestamp() * 1000)
    email = f"case7_{unique_suffix}@fleetflow.com"
    password = "CorrectPassword123!"

    try:
        # Signup
        signup_res = client.post(
            "/auth/signup",
            json={"full_name": "Case 7 Tester", "email": email, "password": password, "role": "Driver"},
        )
        assert signup_res.status_code == 201

        # Verify user in database
        with SessionLocal() as db:
            db.query(User).filter(User.email == email).update({"is_verified": True})
            db.commit()

        # Login with CORRECT password and VERIFIED
        res = client.post(
            "/auth/login",
            data={"username": email, "password": password},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        assert res.status_code == 200
        data = res.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
    finally:
        with SessionLocal() as db:
            from app.models.driver import Driver
            from app.models.email_verification import EmailVerificationToken
            u = db.query(User).filter(User.email == email).first()
            if u:
                db.query(Driver).filter(Driver.user_id == u.user_id).delete()
                db.query(EmailVerificationToken).filter(EmailVerificationToken.user_id == u.user_id).delete()
                db.delete(u)
                db.commit()


@patch("app.routers.auth.send_verification_email", return_value=(True, "Email sent successfully"))
def test_login_role_validation_matrix(mock_send):
    """Test full matrix of correct and mismatched role login attempts."""
    roles_to_test = [
        ("Admin", "Admin"),
        ("FleetManager", "Fleet Manager"),
        ("Dispatcher", "Dispatcher"),
        ("Driver", "Driver"),
    ]

    for db_role, role_display_name in roles_to_test:
        unique_suffix = int(datetime.now().timestamp() * 1000)
        email = f"role_test_{db_role.lower()}_{unique_suffix}@fleetflow.com"
        password = "CorrectPassword123!"

        try:
            # 1. Create user in DB with specific role & verified status
            with SessionLocal() as db:
                from app.core.security import hash_password
                user = User(
                    full_name=f"{db_role} User",
                    email=email,
                    password=hash_password(password),
                    role=db_role,
                    is_verified=True,
                )
                db.add(user)
                db.commit()

            # 2. Correct role login -> 200 OK
            res_correct = client.post(
                "/auth/login",
                data={"username": email, "password": password, "role": db_role},
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            assert res_correct.status_code == 200, f"Expected 200 for {db_role} + {db_role}"
            assert "access_token" in res_correct.json()

            # 3. Wrong role login (e.g. selecting Admin for Driver, or Driver for Admin)
            mismatched_role = "Driver" if db_role != "Driver" else "Admin"
            res_mismatch = client.post(
                "/auth/login",
                data={"username": email, "password": password, "role": mismatched_role},
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            assert res_mismatch.status_code == 400, f"Expected 400 for {db_role} + {mismatched_role}"
            detail = res_mismatch.json()["detail"]
            assert "Role mismatch." in detail
            assert f"This account is registered as {role_display_name}." in detail
            assert "access_token" not in res_mismatch.json()

            # 4. Wrong password with role selected -> 401 Invalid email or password (no role leak)
            res_wrong_pwd = client.post(
                "/auth/login",
                data={"username": email, "password": "WrongPassword999!", "role": mismatched_role},
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            assert res_wrong_pwd.status_code == 401
            assert res_wrong_pwd.json()["detail"] == "Invalid email or password."

        finally:
            with SessionLocal() as db:
                from app.models.driver import Driver
                from app.models.email_verification import EmailVerificationToken
                u = db.query(User).filter(User.email == email).first()
                if u:
                    db.query(Driver).filter(Driver.user_id == u.user_id).delete()
                    db.query(EmailVerificationToken).filter(EmailVerificationToken.user_id == u.user_id).delete()
                    db.delete(u)
                    db.commit()

