import sys
sys.path.insert(0, '.')
from app.config import settings
import psycopg2

conn = psycopg2.connect(settings.DATABASE_URL)
cur = conn.cursor()

tables = [
    'users', 'drivers', 'vehicles', 'attendance', 'fuel_records',
    'gps_tracking', 'notifications', 'vehicle_maintenance', 'shipments', 'trips'
]

for table in tables:
    cur.execute(f"""
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = '{table}'
        ORDER BY ordinal_position;
    """)
    cols = cur.fetchall()
    print(f"\n=== {table} ({len(cols)} columns) ===")
    for col in cols:
        print(f"  {col[0]}: {col[1]}")

cur.close()
conn.close()
