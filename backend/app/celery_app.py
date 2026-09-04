from celery import Celery
from celery.schedules import crontab
from app.config import settings

celery_app = Celery(
    "fleetflow",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.tasks.maintenance"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        "check-maintenance-alerts-every-24h": {
            "task": "app.tasks.maintenance.check_maintenance_alerts_task",
            "schedule": 86400.0,  # Run every 24 hours
        },
    },
)
