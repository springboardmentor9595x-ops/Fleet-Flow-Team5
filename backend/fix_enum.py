import sys
sys.path.insert(0, '.')
from app.config import settings
import psycopg2

conn = psycopg2.connect(settings.DATABASE_URL)
conn.autocommit = True
cur = conn.cursor()
cur.execute("DROP TYPE IF EXISTS roleenum CASCADE;")
print("roleenum type dropped successfully.")
cur.close()
conn.close()
