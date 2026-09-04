from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.main import app
from app.database import SessionLocal
from app.crud.shipment import get_shipment_by_tracking

client = TestClient(app)


def test_shipment_tracking_endpoint_real():
    db: Session = SessionLocal()
    try:
        shipment = get_shipment_by_tracking(db, "TRK-UKDX-CWA2")
        assert shipment is not None, "TRK-UKDX-CWA2 should exist in database"

        # Login as Admin
        login_res = client.post("/api/v1/auth/login", data={"username": "durgabhavani6954@gmail.com", "password": "Password123!"})
        if login_res.status_code == 200:
            token = login_res.json()["access_token"]
            headers = {"Authorization": f"Bearer {token}"}
            res = client.get(f"/api/v1/shipments/{shipment.shipment_id}/tracking", headers=headers)
            assert res.status_code == 200
            data = res.json()
            assert data["tracking_state"] in ["live_tracking_active", "waiting_for_gps"]
            assert data["shipment"]["tracking_number"] == "TRK-UKDX-CWA2"
            assert data["driver"] is not None
            assert data["vehicle"] is not None
    finally:
        db.close()
