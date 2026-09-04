import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.main import app
from app.core.security import create_access_token, hash_password
from app.models.driver import Driver
from app.models.user import User
from app.models.vehicle import Vehicle

from app.database import SessionLocal

client = TestClient(app)


@pytest.fixture
def test_driver_user() -> tuple[User, Driver, str]:
    db = SessionLocal()
    email = "profile_driver_test@example.com"
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        db.query(Driver).filter(Driver.user_id == existing.user_id).delete()
        db.delete(existing)
        db.commit()

    user = User(
        full_name="Driver Test Profile",
        email=email,
        password=hash_password("Password123!"),
        phone="+15551112222",
        role="Driver",
        is_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    driver = Driver(
        user_id=user.user_id,
        license_number="DL-TEST-9999",
        experience_years=5,
        status="Active",
    )
    db.add(driver)
    db.commit()
    db.refresh(driver)

    token = create_access_token(subject=user.email)
    db.close()
    return user, driver, token


@pytest.fixture
def test_admin_user() -> tuple[User, str]:
    db = SessionLocal()
    email = "profile_admin_test@example.com"
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        db.delete(existing)
        db.commit()

    user = User(
        full_name="Admin Test Profile",
        email=email,
        password=hash_password("AdminPass123!"),
        phone="+15559998888",
        role="Admin",
        is_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(subject=user.email)
    db.close()
    return user, token
    db_session.refresh(user)

    token = create_access_token(subject=user.email)
    return user, token


def test_get_my_profile_authenticated(test_driver_user: tuple[User, Driver, str]):
    user, driver, token = test_driver_user
    response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    data = response.json()
    assert data["user_id"] == str(user.user_id)
    assert data["full_name"] == "Driver Test Profile"
    assert data["email"] == user.email
    assert data["role"] == "Driver"
    assert data["is_verified"] is True
    assert data["driver_details"] is not None
    assert data["driver_details"]["license_number"] == "DL-TEST-9999"


def test_get_my_profile_unauthenticated():
    response = client.get("/auth/me")
    assert response.status_code == 401


def test_update_permitted_profile_fields(test_driver_user: tuple[User, Driver, str]):
    user, driver, token = test_driver_user

    update_payload = {
        "full_name": "Updated Driver Name",
        "phone": "+19998887777",
        "address": "123 Fleet Way, Logistics City",
        "emergency_contact": "Jane Doe (+15553334444)",
    }

    response = client.put("/auth/me", json=update_payload, headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()

    assert data["full_name"] == "Updated Driver Name"
    assert data["phone"] == "+19998887777"
    assert data["address"] == "123 Fleet Way, Logistics City"
    assert data["emergency_contact"] == "Jane Doe (+15553334444)"


def test_reject_protected_field_email_modification(test_driver_user: tuple[User, Driver, str]):
    user, driver, token = test_driver_user

    # Attempt to inject email change in payload
    malicious_payload = {
        "full_name": "Hacker Name",
        "email": "hacker_takeover@example.com",
    }

    response = client.put("/auth/me", json=malicious_payload, headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()

    # Original email must remain unchanged
    assert data["email"] == user.email
    assert data["email"] != "hacker_takeover@example.com"


def test_reject_protected_field_role_modification(test_driver_user: tuple[User, Driver, str]):
    user, driver, token = test_driver_user

    # Attempt to inject privilege escalation to Admin
    malicious_payload = {
        "full_name": "Privilege Escalator",
        "role": "Admin",
    }

    response = client.put("/auth/me", json=malicious_payload, headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()

    # Original role must remain Driver
    assert data["role"] == "Driver"
    assert data["role"] != "Admin"


def test_change_password_success(test_driver_user: tuple[User, Driver, str]):
    user, driver, token = test_driver_user

    pwd_payload = {
        "current_password": "Password123!",
        "new_password": "NewSuperPassword123!",
        "confirm_password": "NewSuperPassword123!",
    }

    response = client.post("/auth/change-password", json=pwd_payload, headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["message"] == "Password changed successfully."

    # Verify new password login succeeds
    login_resp = client.post("/auth/login", data={"username": user.email, "password": "NewSuperPassword123!"})
    assert login_resp.status_code == 200


def test_change_password_invalid_current(test_driver_user: tuple[User, Driver, str]):
    user, driver, token = test_driver_user

    pwd_payload = {
        "current_password": "WrongPassword999!",
        "new_password": "NewSuperPassword123!",
        "confirm_password": "NewSuperPassword123!",
    }

    response = client.post("/auth/change-password", json=pwd_payload, headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 400
    assert "Current password is incorrect" in response.json()["detail"]
