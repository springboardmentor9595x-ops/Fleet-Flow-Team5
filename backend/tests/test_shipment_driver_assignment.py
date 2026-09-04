import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.database import get_db
from app.models.user import User
from app.models.driver import Driver
from app.models.shipment import Shipment
from app.core.security import create_access_token, hash_password

client = TestClient(app)


def create_test_user_and_driver(db: Session, email_prefix: str, role: str = "Driver", status: str = "Active"):
    email = f"{email_prefix}_{uuid.uuid4().hex[:6]}@example.com"
    user = User(
        user_id=uuid.uuid4(),
        email=email,
        password=hash_password("TestPass123!"),
        full_name=f"Test {role} {email_prefix}",
        role=role,
        is_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    driver = None
    if role == "Driver":
        driver = Driver(
            driver_id=uuid.uuid4(),
            user_id=user.user_id,
            license_number=f"LIC-{uuid.uuid4().hex[:6].upper()}",
            status=status,
        )
        db.add(driver)
        db.commit()
        db.refresh(driver)

    token = create_access_token(subject=user.email)
    headers = {"Authorization": f"Bearer {token}"}
    return user, driver, headers


def test_shipment_creation_requires_driver():
    db = next(get_db())
    _, _, admin_headers = create_test_user_and_driver(db, "admin", role="Admin")

    # Attempt to create shipment without driver_id
    payload = {
        "source": "New York, NY",
        "destination": "Boston, MA",
        "customer_name": "Acme Corp",
    }
    response = client.post("/shipments/", json=payload, headers=admin_headers)
    assert response.status_code == 400
    assert "Please select a driver" in response.json()["detail"]


def test_shipment_creation_with_invalid_driver_id():
    db = next(get_db())
    _, _, admin_headers = create_test_user_and_driver(db, "admin", role="Admin")

    fake_driver_id = str(uuid.uuid4())
    payload = {
        "source": "New York, NY",
        "destination": "Boston, MA",
        "customer_name": "Acme Corp",
        "driver_id": fake_driver_id,
    }
    response = client.post("/shipments/", json=payload, headers=admin_headers)
    assert response.status_code == 400
    assert "Selected driver is invalid or ineligible" in response.json()["detail"]


def test_shipment_creation_with_inactive_driver():
    db = next(get_db())
    _, _, admin_headers = create_test_user_and_driver(db, "admin", role="Admin")
    _, inactive_driver, _ = create_test_user_and_driver(db, "inactive_driver", role="Driver", status="Inactive")

    payload = {
        "source": "New York, NY",
        "destination": "Boston, MA",
        "customer_name": "Acme Corp",
        "driver_id": str(inactive_driver.driver_id),
    }
    response = client.post("/shipments/", json=payload, headers=admin_headers)
    assert response.status_code == 400
    assert "Selected driver is invalid or ineligible" in response.json()["detail"]


def test_shipment_creation_with_valid_driver_success():
    db = next(get_db())
    _, _, admin_headers = create_test_user_and_driver(db, "admin", role="Admin")
    driver_user, active_driver, _ = create_test_user_and_driver(db, "active_driver", role="Driver", status="Active")

    payload = {
        "source": "Chicago, IL",
        "destination": "Detroit, MI",
        "customer_name": "Logistics LLC",
        "driver_id": str(active_driver.driver_id),
    }
    response = client.post("/shipments/", json=payload, headers=admin_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["driver_id"] == str(active_driver.driver_id)
    assert data["driver_name"] == driver_user.full_name
    assert data["status"] == "Assigned"


def test_shipments_list_returns_driver_name():
    db = next(get_db())
    _, _, admin_headers = create_test_user_and_driver(db, "admin", role="Admin")

    response = client.get("/shipments/", headers=admin_headers)
    assert response.status_code == 200
    shipments = response.json()
    assert isinstance(shipments, list)
    for s in shipments:
        assert "driver_name" in s


def test_unauthorized_driver_cannot_create_shipment():
    db = next(get_db())
    _, _, driver_headers = create_test_user_and_driver(db, "driver_user", role="Driver")
    _, active_driver, _ = create_test_user_and_driver(db, "target_driver", role="Driver")

    payload = {
        "source": "Dallas, TX",
        "destination": "Austin, TX",
        "customer_name": "Texas Goods",
        "driver_id": str(active_driver.driver_id),
    }
    response = client.post("/shipments/", json=payload, headers=driver_headers)
    assert response.status_code == 403
