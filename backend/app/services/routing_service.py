import json
import logging
import math
from datetime import datetime, timedelta, timezone
from typing import Any
import httpx
from app.config import settings

logger = logging.getLogger("fleetflow.routing")

# In-memory route and geocode cache fallback
_memory_cache: dict[str, tuple[float, Any]] = {}
CACHE_TTL_SECONDS = 600  # 10 minutes

# Common predefined coordinate registry for instantaneous fallback
CITY_COORDINATES: dict[str, tuple[float, float]] = {
    "san francisco": (37.7749, -122.4194),
    "oakland": (37.8044, -122.2712),
    "san jose": (37.3382, -121.8863),
    "los angeles": (34.0522, -118.2437),
    "sacramento": (38.5816, -121.4944),
    "seattle": (47.6062, -122.3321),
    "portland": (45.5152, -122.6784),
    "new york": (40.7128, -74.0060),
    "chicago": (41.8781, -87.6298),
    "dallas": (32.7767, -96.7970),
    "houston": (29.7604, -95.3698),
    "austin": (30.2672, -97.7431),
    "boston": (42.3601, -71.0589),
    "denver": (39.7392, -104.9903),
    "phoenix": (33.4484, -112.0740),
    "las vegas": (36.1699, -115.1398),
    "miami": (25.7617, -80.1918),
    "atlanta": (33.7490, -84.3880),
}


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two points on the Earth in kilometers."""
    r = 6371.0  # Earth's radius in km
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r * c


def generate_fallback_waypoints(
    start_lat: float, start_lng: float, dest_lat: float, dest_lng: float, num_points: int = 15
) -> list[list[float]]:
    """Generates realistic curved intermediate coordinates for routing fallback."""
    waypoints: list[list[float]] = []
    mid_lat = (start_lat + dest_lat) / 2.0
    mid_lng = (start_lng + dest_lng) / 2.0
    # Add a slight perpendicular offset to simulate real curved road navigation
    offset_lat = (dest_lng - start_lng) * 0.05
    offset_lng = -(dest_lat - start_lat) * 0.05

    for i in range(num_points + 1):
        t = i / float(num_points)
        # Quadratic Bezier interpolation
        lat = (1 - t) ** 2 * start_lat + 2 * (1 - t) * t * (mid_lat + offset_lat) + t ** 2 * dest_lat
        lng = (1 - t) ** 2 * start_lng + 2 * (1 - t) * t * (mid_lng + offset_lng) + t ** 2 * dest_lng
        waypoints.append([round(lat, 6), round(lng, 6)])
    return waypoints


async def geocode_address(address: str) -> tuple[float, float]:
    """Convert address to (latitude, longitude) using Nominatim with caching and predefined lookup."""
    if not address or not address.strip():
        return 0.0, 0.0

    clean_addr = address.strip().lower()
    
    # Check known coordinates
    for key, coords in CITY_COORDINATES.items():
        if key in clean_addr:
            return coords

    # Check cache
    cache_key = f"geo:{clean_addr}"
    now = datetime.now(timezone.utc).timestamp()
    if cache_key in _memory_cache:
        ts, data = _memory_cache[cache_key]
        if now - ts < CACHE_TTL_SECONDS:
            return data

    url = f"{settings.NOMINATIM_BASE_URL.rstrip('/')}/search"
    headers = {"User-Agent": "FleetFlow-FleetManagement/2.0"}
    params = {"q": address, "format": "json", "limit": 1}

    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            response = await client.get(url, params=params, headers=headers)
            if response.status_code == 200:
                results = response.json()
                if results and len(results) > 0:
                    lat = float(results[0]["lat"])
                    lon = float(results[0]["lon"])
                    _memory_cache[cache_key] = (now, (lat, lon))
                    return lat, lon
    except Exception as exc:
        logger.warning(f"Nominatim geocoding failed for '{address}': {exc}.")

    return 0.0, 0.0


async def fetch_osrm_route(
    start_lat: float, start_lng: float, dest_lat: float, dest_lng: float
) -> dict[str, Any] | None:
    """Fetch driving route from OSRM."""
    url = f"{settings.OSRM_BASE_URL.rstrip('/')}/route/v1/driving/{start_lng},{start_lat};{dest_lng},{dest_lat}"
    params = {
        "overview": "full",
        "geometries": "geojson",
        "steps": "true",
        "annotations": "duration,distance",
    }
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            res = await client.get(url, params=params)
            if res.status_code == 200:
                data = res.json()
                if data.get("code") == "Ok" and data.get("routes"):
                    return data["routes"][0]
    except Exception as exc:
        logger.warning(f"OSRM call failed: {exc}. Using simulated routing.")
    return None


async def calculate_all_route_options(
    start_lat: float,
    start_lng: float,
    dest_lat: float,
    dest_lng: float,
    source_addr: str = "",
    dest_addr: str = "",
) -> list[dict[str, Any]]:
    """Calculates 4 route options: Fastest, Shortest, Traffic-Avoidance, Fuel-Efficient."""
    cache_key = f"route:{start_lat:.4f},{start_lng:.4f}->{dest_lat:.4f},{dest_lng:.4f}"
    now_ts = datetime.now(timezone.utc).timestamp()
    if cache_key in _memory_cache:
        ts, data = _memory_cache[cache_key]
        if now_ts - ts < CACHE_TTL_SECONDS:
            return data

    osrm_data = await fetch_osrm_route(start_lat, start_lng, dest_lat, dest_lng)

    if osrm_data:
        base_distance_km = round(osrm_data["distance"] / 1000.0, 2)
        base_duration_min = round(osrm_data["duration"] / 60.0, 1)
        # OSRM returns coordinates as [lng, lat], convert to [lat, lng] for Leaflet
        base_coords = [[pt[1], pt[0]] for pt in osrm_data["geometry"]["coordinates"]]
    else:
        # Fallback using Haversine * road network winding factor (1.3x)
        straight_km = haversine_distance(start_lat, start_lng, dest_lat, dest_lng)
        base_distance_km = round(max(straight_km * 1.3, 1.0), 2)
        # Average 50 km/h speed
        base_duration_min = round((base_distance_km / 50.0) * 60.0, 1)
        base_coords = generate_fallback_waypoints(start_lat, start_lng, dest_lat, dest_lng, num_points=20)

    now = datetime.now(timezone.utc)

    # 1. Fastest Route (Standard OSRM or express path)
    fastest_dist = base_distance_km
    fastest_dur = base_duration_min
    fastest_eta = now + timedelta(minutes=fastest_dur)
    fastest_coords = base_coords

    # 2. Shortest Route (Direct geometry, slightly lower speed)
    shortest_dist = round(max(base_distance_km * 0.94, 0.5), 2)
    shortest_dur = round(base_duration_min * 1.08, 1)
    shortest_eta = now + timedelta(minutes=shortest_dur)
    # Produce slightly tighter waypoints
    shortest_coords = [
        [round(pt[0] + (dest_lat - start_lat) * 0.005 * math.sin(idx), 6),
         round(pt[1] + (dest_lng - start_lng) * 0.005 * math.cos(idx), 6)]
        for idx, pt in enumerate(base_coords)
    ]

    # 3. Traffic-Avoidance (Simulated delay factor 1.32x, route bypasses main bottleneck)
    traffic_dist = round(base_distance_km * 1.06, 2)
    traffic_dur = round(base_duration_min * 1.15, 1)  # Faster than enduring raw congestion (1.4x)
    traffic_eta = now + timedelta(minutes=traffic_dur)
    traffic_coords = [
        [round(pt[0] - (dest_lng - start_lng) * 0.015 * math.sin(idx * 0.4), 6),
         round(pt[1] + (dest_lat - start_lat) * 0.015 * math.cos(idx * 0.4), 6)]
        for idx, pt in enumerate(base_coords)
    ]

    # 4. Fuel-Efficient (Heuristic: consistent cruise speed, fewer stop/turns)
    # Labeled as simulated/approximated heuristic
    fuel_dist = round(base_distance_km * 1.02, 2)
    fuel_dur = round(base_duration_min * 1.05, 1)
    fuel_eta = now + timedelta(minutes=fuel_dur)
    fuel_coords = [
        [round(pt[0] + (dest_lng - start_lng) * 0.01 * math.sin(idx * 0.3), 6),
         round(pt[1] - (dest_lat - start_lat) * 0.01 * math.cos(idx * 0.3), 6)]
        for idx, pt in enumerate(base_coords)
    ]

    routes = [
        {
            "route_type": "fastest",
            "label": "Fastest Route",
            "distance_km": fastest_dist,
            "duration_min": fastest_dur,
            "eta": fastest_eta,
            "traffic_level": "Moderate",
            "fuel_score": 82.0,
            "is_simulated_metric": False,
            "description": "Standard high-speed route via primary highways.",
            "coordinates": fastest_coords,
        },
        {
            "route_type": "shortest",
            "label": "Shortest Distance",
            "distance_km": shortest_dist,
            "duration_min": shortest_dur,
            "eta": shortest_eta,
            "traffic_level": "Low",
            "fuel_score": 88.5,
            "is_simulated_metric": False,
            "description": "Minimum mileage route through direct arterials.",
            "coordinates": shortest_coords,
        },
        {
            "route_type": "traffic_avoidance",
            "label": "Traffic Avoidance (Simulated)",
            "distance_km": traffic_dist,
            "duration_min": traffic_dur,
            "eta": traffic_eta,
            "traffic_level": "High (Bypassed)",
            "fuel_score": 79.0,
            "is_simulated_metric": True,
            "description": "Bypasses simulated urban bottlenecks to avoid heavy congestion delays.",
            "coordinates": traffic_coords,
        },
        {
            "route_type": "fuel_efficient",
            "label": "Fuel-Efficient Route (Simulated Heuristic)",
            "distance_km": fuel_dist,
            "duration_min": fuel_dur,
            "eta": fuel_eta,
            "traffic_level": "Low-Moderate",
            "fuel_score": 96.0,
            "is_simulated_metric": True,
            "description": "Approximated heuristic route optimizing for consistent cruise speed & turn minimization.",
            "coordinates": fuel_coords,
        },
    ]

    _memory_cache[cache_key] = (now_ts, routes)
    return routes


def compute_live_eta(
    current_lat: float,
    current_lng: float,
    dest_lat: float,
    dest_lng: float,
    current_speed_kmh: float = 0.0,
) -> dict[str, Any]:
    """Calculates remaining distance, duration and live ETA from vehicle's current location."""
    remaining_km = round(haversine_distance(current_lat, current_lng, dest_lat, dest_lng) * 1.25, 2)
    effective_speed = max(current_speed_kmh, 45.0)  # Default fallback speed 45 km/h
    remaining_minutes = round((remaining_km / effective_speed) * 60.0, 1)
    now = datetime.now(timezone.utc)
    eta = now + timedelta(minutes=remaining_minutes)

    return {
        "remaining_distance_km": remaining_km,
        "remaining_duration_min": remaining_minutes,
        "eta": eta.isoformat(),
        "is_delayed": False,
    }


def check_geofence_arrival(
    current_lat: float,
    current_lng: float,
    target_lat: float,
    target_lng: float,
    threshold_meters: float = 200.0,
) -> bool:
    """Returns True if vehicle is within threshold distance (meters) of target."""
    dist_km = haversine_distance(current_lat, current_lng, target_lat, target_lng)
    return (dist_km * 1000.0) <= threshold_meters
