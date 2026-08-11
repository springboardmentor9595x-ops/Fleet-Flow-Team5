import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.user import User

client = TestClient(app)


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
        data={"username": "valid.user@fleetflow.com", "password": ""},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert res.status_code == 400
    assert res.json()["detail"] == "Password is required."


def test_login_case_4_non_existent_email():
    res = client.post(
        "/auth/login",
        data={"username": "nonexistent_email_99999@fleetflow.com", "password": "AnyPassword123!"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert res.status_code == 401
    assert res.json()["detail"] == "Invalid email or password."


def test_login_case_5_existing_email_wrong_password():
    # Use existing seeded user or create a temporary one
    unique_suffix = int(datetime.now().timestamp() * 1000)
    email = f"case5_{unique_suffix}@fleetflow.com"
    password = "CorrectPassword123!"

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


def test_login_case_6_existing_email_unverified():
    unique_suffix = int(datetime.now().timestamp() * 1000)
    email = f"case6_{unique_suffix}@fleetflow.com"
    password = "CorrectPassword123!"

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


def test_login_case_7_existing_email_verified():
    unique_suffix = int(datetime.now().timestamp() * 1000)
    email = f"case7_{unique_suffix}@fleetflow.com"
    password = "CorrectPassword123!"

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
