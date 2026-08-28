from celery import Celery
from celery.schedules import crontab
import os
from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "fleetflow",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["app.tasks.maintenance", "app.tasks.shipments"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

# Scheduled (recurring) jobs — this is Celery Beat's job list
celery_app.conf.beat_schedule = {
    "check-maintenance-alerts-every-hour": {
        "task": "app.tasks.maintenance.check_maintenance_alerts",
        "schedule": crontab(minute=0),  # runs at the top of every hour
    },
    "check-delayed-shipments-every-10-min": {
        "task": "app.tasks.shipments.check_delayed_shipments",
        "schedule": crontab(minute="*/10"),  # runs every 10 minutes
    },
}
