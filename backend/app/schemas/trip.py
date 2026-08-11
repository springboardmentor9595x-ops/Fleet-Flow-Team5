from datetime import datetime
from typing import Any
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class RouteOption(BaseModel):
    route_type: str = Field(..., description="fastest, shortest, traffic_avoidance, fuel_efficient")
    label: str
    distance_km: float
    duration_min: float
    eta: datetime
    traffic_level: str  # Low, Moderate, High, Severe (Simulated)
    fuel_score: float  # Index 0-100 (Heuristic: fewer stops/turns)
    is_simulated_metric: bool = True
    description: str
    coordinates: list[list[float]]  # [[lat, lng], ...]


class RouteCalculateRequest(BaseModel):
    source: str
    destination: str
    start_lat: float | None = None
    start_lng: float | None = None
    dest_lat: float | None = None
    dest_lng: float | None = None


class RouteCalculateResponse(BaseModel):
    source_address: str
    dest_address: str
    source_coords: list[float]  # [lat, lng]
    dest_coords: list[float]    # [lat, lng]
    routes: list[RouteOption]


class TripCreate(BaseModel):
    shipment_id: UUID
    vehicle_id: UUID
    driver_id: UUID | None = None
    start_location: str
    destination: str
    start_lat: float | None = None
    start_lng: float | None = None
    dest_lat: float | None = None
    dest_lng: float | None = None
    route_type: str = "fastest"
    planned_distance_km: float | None = None
    planned_duration_min: float | None = None
    route_geometry: list[list[float]] | dict[str, Any] | None = None


class TripRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    trip_id: UUID
    vehicle_id: UUID | None = None
    driver_id: UUID | None = None
    shipment_id: UUID | None = None
    start_location: str | None = None
    destination: str | None = None
    start_lat: float | None = None
    start_lng: float | None = None
    dest_lat: float | None = None
    dest_lng: float | None = None
    route_type: str
    route_geometry: Any = None
    planned_distance_km: float | None = None
    planned_duration_min: float | None = None
    actual_distance_km: float | None = None
    actual_duration_min: float | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    status: str
    created_at: datetime
    updated_at: datetime


class TripRecalculateRequest(BaseModel):
    current_lat: float
    current_lng: float
    route_type: str | None = None


class TripActionResponse(BaseModel):
    trip_id: UUID
    status: str
    message: str
    timestamp: datetime
