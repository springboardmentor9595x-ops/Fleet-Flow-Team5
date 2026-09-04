import os
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models.vehicle import Vehicle
from app.crud.analytics import compute_fleet_utilization

def test_fleet_utilization_calculation_scenarios():
    db = SessionLocal()
    # Use a transaction block and roll back so database is never modified
    try:
        # Create isolated test vehicles
        v1 = Vehicle(vehicle_id=uuid.uuid4(), registration_number=f"UTIL_TEST_1_{uuid.uuid4().hex[:6]}", status="Assigned")
        v2 = Vehicle(vehicle_id=uuid.uuid4(), registration_number=f"UTIL_TEST_2_{uuid.uuid4().hex[:6]}", status="In Transit")
        v3 = Vehicle(vehicle_id=uuid.uuid4(), registration_number=f"UTIL_TEST_3_{uuid.uuid4().hex[:6]}", status="Available")
        
        db.add_all([v1, v2, v3])
        db.flush()

        res = compute_fleet_utilization(db)
        assert res.total_vehicles >= 3
        assert res.utilized_vehicles >= 2
        assert res.total_active_vehicles >= 3
        assert isinstance(res.fleet_utilization_rate_pct, float)
    finally:
        db.rollback()
        db.close()
