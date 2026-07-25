"""
FleetFlow API entry point.

Run with:
    uvicorn app.main:app --reload

Then visit:
    http://127.0.0.1:8000/       -> health/root check
    http://127.0.0.1:8000/docs   -> Swagger UI
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import auth

app = FastAPI(title=settings.PROJECT_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["Authentication"])


@app.get("/")
def root() -> dict[str, str]:
    """Basic liveness check used to confirm the server booted correctly."""
    return {"message": "FleetFlow API running"}
