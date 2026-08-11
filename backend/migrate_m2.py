import sys
sys.path.insert(0, '.')
from app.config import settings
from app.database import engine, Base
import app.models  # Import all models so Base knows about them
import psycopg2

def migrate():
    conn = psycopg2.connect(settings.DATABASE_URL)
    conn.autocommit = True
    cur = conn.cursor()

    print("Checking database migration for Milestone 2...")

    # 1. Create shipment_history table if not exists
    cur.execute("""
    CREATE TABLE IF NOT EXISTS shipment_history (
        history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        shipment_id UUID NOT NULL REFERENCES shipments(shipment_id) ON DELETE CASCADE,
        status VARCHAR(30) NOT NULL,
        note TEXT,
        changed_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
        changed_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (now() at time zone 'utc')
    );
    """)
    print("[OK] shipment_history table ready")

    # 2. Ensure columns on shipments table
    cur.execute("""
    ALTER TABLE shipments ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(20);
    ALTER TABLE shipments ADD COLUMN IF NOT EXISTS notes TEXT;
    ALTER TABLE shipments ADD COLUMN IF NOT EXISTS expected_delivery TIMESTAMP WITHOUT TIME ZONE;
    ALTER TABLE shipments ADD COLUMN IF NOT EXISTS source_lat NUMERIC(10, 7);
    ALTER TABLE shipments ADD COLUMN IF NOT EXISTS source_lon NUMERIC(10, 7);
    ALTER TABLE shipments ADD COLUMN IF NOT EXISTS destination_lat NUMERIC(10, 7);
    ALTER TABLE shipments ADD COLUMN IF NOT EXISTS destination_lon NUMERIC(10, 7);
    ALTER TABLE shipments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (now() at time zone 'utc');
    """)
    print("[OK] shipments table columns ready")

    # 3. Ensure columns on trips table
    cur.execute("""
    ALTER TABLE trips ADD COLUMN IF NOT EXISTS planned_route_type VARCHAR(30) DEFAULT 'fastest';
    ALTER TABLE trips ADD COLUMN IF NOT EXISTS route_geometry TEXT;
    ALTER TABLE trips ADD COLUMN IF NOT EXISTS estimated_duration NUMERIC(10, 2);
    ALTER TABLE trips ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (now() at time zone 'utc');
    """)
    print("[OK] trips table columns ready")

    # 4. Ensure columns on gps_tracking table
    cur.execute("""
    ALTER TABLE gps_tracking ADD COLUMN IF NOT EXISTS heading NUMERIC(5, 2);
    ALTER TABLE gps_tracking ADD COLUMN IF NOT EXISTS altitude NUMERIC(8, 2);
    ALTER TABLE gps_tracking ADD COLUMN IF NOT EXISTS accuracy NUMERIC(8, 2);
    """)
    print("[OK] gps_tracking table columns ready")

    # 5. Fix/Ensure Enum values on PostgreSQL for shipmentstatusenum if enum exists
    try:
        cur.execute("SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'shipmentstatusenum';")
        existing_labels = [row[0] for row in cur.fetchall()]
        needed_labels = ['Created', 'Assigned', 'In Transit', 'Delayed', 'Delivered', 'Cancelled']
        for label in needed_labels:
            if label not in existing_labels:
                cur.execute(f"ALTER TYPE shipmentstatusenum ADD VALUE IF NOT EXISTS '{label}';")
        print("[OK] shipmentstatusenum labels updated")
    except Exception as e:
        print(f"Enum check notice: {e}")

    cur.close()
    conn.close()
    print("Migration finished successfully.")

if __name__ == "__main__":
    migrate()
