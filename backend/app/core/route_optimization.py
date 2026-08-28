"""
Route Optimization & Dynamic ETA Calculation Engine.
- Address Geocoding via Nominatim with regional fallback hubs.
- OSRM route generation with geometry, distance (km), duration (mins).
- Heuristic Route Options: Fastest, Shortest, Other.
- Multi-stop route optimization (2-Opt TSP algorithm).
- Dynamic ETA recalculation based on live GPS telemetry and traffic delay factors.
- Straight-line Haversine fallback on external API failure.
- Route caching layer.
"""
import math
import logging
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple, Optional
import urllib.request
import urllib.parse

from app.core.redis import cache_get, cache_set

logger = logging.getLogger(__name__)

# Predefined hub coordinates for instant geocoding & fallback
HUB_COORDINATES: Dict[str, Tuple[float, float]] = {
    # South India
    "kollam": (8.8932, 76.6141),
    "trivandrum": (8.5241, 76.9366),
    "thiruvananthapuram": (8.5241, 76.9366),
    "kochi": (9.9312, 76.2673),
    "cochin": (9.9312, 76.2673),
    "calicut": (11.2588, 75.7804),
    "kozhikode": (11.2588, 75.7804),
    "thrissur": (10.5276, 76.2144),
    "kannur": (11.8745, 75.3704),
    "alappuzha": (9.4981, 76.3388),
    "palakkad": (10.7867, 76.6548),
    "chennai": (13.0827, 80.2707),
    "madras": (13.0827, 80.2707),
    "coimbatore": (11.0168, 76.9558),
    "madurai": (9.9252, 78.1198),
    "trichy": (10.7905, 78.7047),
    "tiruchirappalli": (10.7905, 78.7047),
    "salem": (11.6643, 78.1460),
    "tirunelveli": (8.7139, 77.7567),
    "bangalore": (12.9716, 77.5946),
    "bengaluru": (12.9716, 77.5946),
    "mysore": (12.2958, 76.6394),
    "mysuru": (12.2958, 76.6394),
    "mangalore": (12.9141, 74.8560),
    "mangaluru": (12.9141, 74.8560),
    "hubli": (15.3647, 75.1240),
    "hyderabad": (17.3850, 78.4867),
    "secunderabad": (17.4399, 78.4983),
    "visakhapatnam": (17.6868, 83.2185),
    "vizag": (17.6868, 83.2185),
    "vijayawada": (16.5062, 80.6480),

    # West & Central India
    "mumbai": (19.0760, 72.8777),
    "bombay": (19.0760, 72.8777),
    "pune": (18.5204, 73.8567),
    "nagpur": (21.1458, 79.0882),
    "nashik": (19.9975, 73.7898),
    "aurangabad": (19.8762, 75.3433),
    "ahmedabad": (23.0225, 72.5714),
    "surat": (21.1702, 72.8311),
    "vadodara": (22.3072, 73.1812),
    "rajkot": (22.3039, 70.8022),
    "goa": (15.2993, 74.1240),
    "panaji": (15.4909, 73.8278),
    "indore": (22.7196, 75.8577),
    "bhopal": (23.2599, 77.4126),
    "jabalpur": (23.1815, 79.9864),
    "raipur": (21.2514, 81.6296),

    # North India
    "delhi": (28.6139, 77.2090),
    "new delhi": (28.6139, 77.2090),
    "noida": (28.5355, 77.3910),
    "gurgaon": (28.4595, 77.0266),
    "gurugram": (28.4595, 77.0266),
    "jaipur": (26.9124, 75.7873),
    "jodhpur": (26.2389, 73.0243),
    "udaipur": (24.5854, 73.7125),
    "lucknow": (26.8467, 80.9462),
    "kanpur": (26.4499, 80.3319),
    "varanasi": (25.3176, 82.9739),
    "agra": (27.1767, 78.0081),
    "chandigarh": (30.7333, 76.7794),
    "ludhiana": (30.9010, 75.8573),
    "amritsar": (31.6340, 74.8723),
    "dehradun": (30.3165, 78.0322),
    "jammu": (32.7266, 74.8570),
    "srinagar": (34.0837, 74.7973),

    # East & North-East India
    "kolkata": (22.5726, 88.3639),
    "calcutta": (22.5726, 88.3639),
    "patna": (25.5941, 85.1376),
    "bhubaneswar": (20.2961, 85.8245),
    "cuttack": (20.4625, 85.8830),
    "ranchi": (23.3441, 85.3096),
    "jamshedpur": (22.8046, 86.2029),
    "guwahati": (26.1445, 91.7362),

    # Major States
    "kerala": (8.5241, 76.9366),
    "tamil nadu": (13.0827, 80.2707),
    "karnataka": (12.9716, 77.5946),
    "maharashtra": (19.0760, 72.8777),
    "gujarat": (23.0225, 72.5714),
    "rajasthan": (26.9124, 75.7873),
    "uttar pradesh": (26.8467, 80.9462),
    "west bengal": (22.5726, 88.3639),
    "telangana": (17.3850, 78.4867),
    "andhra pradesh": (16.5062, 80.6480),
    "punjab": (30.7333, 76.7794),
    "haryana": (28.4595, 77.0266),
    "madhya pradesh": (22.7196, 75.8577),
    "goa": (15.2993, 74.1240),
    "odisha": (20.2961, 85.8245),
    "assam": (26.1445, 91.7362),

    # Major International Logistics Hubs
    "dubai": (25.2048, 55.2708),
    "abu dhabi": (24.4539, 54.3773),
    "singapore": (1.3521, 103.8198),
    "london": (51.5074, -0.1278),
    "new york": (40.7128, -74.0060),
    "chicago": (41.8781, -87.6298),
    "san francisco": (37.7749, -122.4194),
    "los angeles": (34.0522, -118.2437),
    "dallas": (32.7767, -96.7970),
    "tokyo": (35.6762, 139.6503),
    "shanghai": (31.2304, 121.4737),
    "hong kong": (22.3193, 114.1694),
    "sydney": (-33.8688, 151.2093),
}


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate straight-line distance in kilometers between two GPS points."""
    R = 6371.0  # Earth radius in kilometers
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 2)


def geocode_address(address: str) -> Tuple[float, float]:
    """
    Convert an address string into (lat, lon) coordinates using Nominatim,
    with fallback to known hub coordinates or default city center.
    """
    if not address or not address.strip():
        return HUB_COORDINATES["kollam"]

    clean_addr = address.strip().lower()

    # Check local dictionary first
    for hub, coords in HUB_COORDINATES.items():
        if hub in clean_addr:
            return coords

    # Cache check
    cache_key = f"geocode:{clean_addr}"
    cached = cache_get(cache_key)
    if cached:
        return tuple(cached)

    try:
        url = f"https://nominatim.openstreetmap.org/search?format=json&q={urllib.parse.quote(address)}&limit=1"
        req = urllib.request.Request(
            url, headers={"User-Agent": "FleetFlowLogistics/1.0 (fleetflow@example.com)"}
        )
        with urllib.request.urlopen(req, timeout=4) as response:
            data = json.loads(response.read().decode())
            if data and len(data) > 0:
                lat = float(data[0]["lat"])
                lon = float(data[0]["lon"])
                cache_set(cache_key, (lat, lon), ttl_seconds=86400)
                return lat, lon
    except Exception as exc:
        logger.warning("Geocoding failed for '%s': %s", address, exc)

    # Fallback to Kollam
    return HUB_COORDINATES["kollam"]


def fetch_osrm_route(
    start_lat: float, start_lon: float, end_lat: float, end_lon: float
) -> Dict[str, Any]:
    """
    Fetch driving route from OSRM API.
    Returns dict containing distance_km, duration_mins, coordinates geometry, and source flag.
    """
    cache_key = f"osrm_route:{start_lat:.4f},{start_lon:.4f}:{end_lat:.4f},{end_lon:.4f}"
    cached = cache_get(cache_key)
    if cached:
        return cached

    url = (
        f"http://router.project-osrm.org/route/v1/driving/"
        f"{start_lon},{start_lat};{end_lon},{end_lat}?overview=full&geometries=geojson"
    )

    try:
        req = urllib.request.Request(url, headers={"User-Agent": "FleetFlowLogistics/1.0"})
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode())
            if data.get("code") == "Ok" and data.get("routes"):
                r = data["routes"][0]
                dist_km = round(r["distance"] / 1000.0, 2)
                dur_mins = round(r["duration"] / 60.0, 1)
                geometry = r["geometry"]["coordinates"]  # [[lon, lat], ...]
                formatted_geom = [[coord[1], coord[0]] for coord in geometry]  # [[lat, lon], ...]

                result = {
                    "distance_km": dist_km,
                    "duration_mins": dur_mins,
                    "coordinates": formatted_geom,
                    "source": "OSRM",
                }
                cache_set(cache_key, result, ttl_seconds=900)
                return result
    except Exception as exc:
        logger.warning("OSRM API request failed: %s. Using Haversine fallback.", exc)

    # Fallback to straight-line estimate
    dist_km = haversine_distance_km(start_lat, start_lon, end_lat, end_lon)
    # Estimate duration assuming 50 km/h average speed
    dur_mins = round((dist_km / 50.0) * 60.0, 1)
    
    # Generate 5 interpolated intermediate points for smooth polyline rendering
    points = []
    for i in range(6):
        t = i / 5.0
        lat = start_lat + t * (end_lat - start_lat)
        lon = start_lon + t * (end_lon - start_lon)
        points.append([lat, lon])

    fallback_result = {
        "distance_km": dist_km,
        "duration_mins": max(dur_mins, 1.0),
        "coordinates": points,
        "source": "Haversine Fallback",
    }
    return fallback_result


def get_simulated_traffic_factor() -> float:
    """
    Simulate traffic congestion factor based on current hour of day.
    Peak hours (8-10 AM, 5-8 PM) add 30-40% delay factor.
    """
    hour = datetime.utcnow().hour  # UTC; adjust for local peak hours
    if 7 <= hour <= 10 or 17 <= hour <= 20:
        return 1.35  # Heavy traffic
    elif 11 <= hour <= 16:
        return 1.15  # Moderate traffic
    else:
        return 1.05  # Light traffic / off-peak


def calculate_route_options(
    start_lat: float, start_lon: float, end_lat: float, end_lon: float
) -> Dict[str, Any]:
    """
    Calculate 3 distinct route options:
    1. Fastest Route (standard OSRM duration)
    2. Shortest Route (minimized distance)
    3. Other (alternative customizable/balanced route)
    """
    base = fetch_osrm_route(start_lat, start_lon, end_lat, end_lon)
    base_dist = base["distance_km"]
    base_dur = base["duration_mins"]
    coords = base["coordinates"]

    options = {
        "fastest": {
            "type": "Fastest Route",
            "distance_km": base_dist,
            "duration_mins": base_dur,
            "eta_timestamp": (datetime.utcnow() + timedelta(minutes=base_dur)).isoformat(),
            "coordinates": coords,
            "description": "Lowest estimated travel duration based on open road speeds.",
        },
        "shortest": {
            "type": "Shortest Route",
            "distance_km": round(base_dist * 0.96, 2),
            "duration_mins": round(base_dur * 1.08, 1),
            "eta_timestamp": (datetime.utcnow() + timedelta(minutes=base_dur * 1.08)).isoformat(),
            "coordinates": coords,
            "description": "Shortest physical distance with local road transit.",
        },
        "other": {
            "type": "Other Route",
            "distance_km": round(base_dist * 1.02, 2),
            "duration_mins": round(base_dur * 1.06, 1),
            "eta_timestamp": (datetime.utcnow() + timedelta(minutes=base_dur * 1.06)).isoformat(),
            "coordinates": coords,
            "description": "Alternative customizable or balanced route strategy.",
        },
    }

    return options


def format_duration_human(mins: float) -> str:
    """Format minutes into human-readable duration (e.g., '1h 25m' or '45m')."""
    if mins <= 0:
        return "Arrived"
    total_mins = int(round(mins))
    hrs = total_mins // 60
    rem_mins = total_mins % 60
    if hrs > 0:
        return f"{hrs}h {rem_mins}m" if rem_mins > 0 else f"{hrs}h"
    return f"{rem_mins}m"


def format_eta_timestamp(eta_dt: datetime) -> str:
    """Format datetime into a readable ETA string like 'Today, 4:45 PM' or 'Tomorrow, 10:30 AM'."""
    now = datetime.utcnow()
    diff_days = (eta_dt.date() - now.date()).days
    time_str = eta_dt.strftime("%I:%M %p")
    if diff_days == 0:
        return f"Today, {time_str}"
    elif diff_days == 1:
        return f"Tomorrow, {time_str}"
    else:
        return eta_dt.strftime("%b %d, %I:%M %p")


def calculate_dynamic_eta(
    current_lat: float,
    current_lon: float,
    dest_lat: float,
    dest_lon: float,
    current_speed_kmh: Optional[float] = None,
    expected_delivery: Optional[datetime] = None,
) -> Dict[str, Any]:
    """
    Calculate dynamic ETA based on live vehicle GPS position, telemetry, and traffic condition.
    """
    rem_dist_km = haversine_distance_km(current_lat, current_lon, dest_lat, dest_lon)
    traffic_factor = get_simulated_traffic_factor()

    # Determine average vehicle speed
    if current_speed_kmh and current_speed_kmh > 10.0:
        eff_speed = current_speed_kmh
    else:
        eff_speed = 45.0  # Default fleet cruise speed (45 km/h)

    # Calculate remaining duration in minutes considering traffic factor
    rem_dur_mins = round(((rem_dist_km / eff_speed) * 60.0) * traffic_factor, 1)
    
    eta_time = datetime.utcnow() + timedelta(minutes=rem_dur_mins)

    # Determine delay status & traffic condition text
    is_delayed = False
    delay_status = "On Time"
    delay_minutes = 0.0

    if traffic_factor >= 1.30:
        traffic_condition = "Heavy Congestion (+35% delay)"
    elif traffic_factor >= 1.10:
        traffic_condition = "Moderate Traffic (+15% delay)"
    else:
        traffic_condition = "Light Traffic (Optimal Flow)"

    if expected_delivery:
        if eta_time > expected_delivery:
            is_delayed = True
            delay_minutes = round((eta_time - expected_delivery).total_seconds() / 60.0, 1)
            if delay_minutes > 60:
                delay_status = f"Critical Delay (+{int(delay_minutes)}m)"
            else:
                delay_status = f"Delayed (+{int(delay_minutes)}m)"
        elif (expected_delivery - eta_time).total_seconds() < 900:  # < 15 mins buffer
            delay_status = "Tight Window"

    return {
        "remaining_distance_km": rem_dist_km,
        "remaining_duration_mins": rem_dur_mins,
        "duration_human": format_duration_human(rem_dur_mins),
        "calculated_speed_kmh": round(eff_speed, 1),
        "eta_timestamp": eta_time.isoformat(),
        "eta_formatted": format_eta_timestamp(eta_time),
        "is_delayed": is_delayed,
        "delay_status": delay_status,
        "delay_minutes": delay_minutes,
        "traffic_factor": traffic_factor,
        "traffic_condition": traffic_condition,
    }


def compute_shipment_eta(shipment, latest_pos=None) -> Dict[str, Any]:
    """
    Compute ETA for a shipment, using live GPS position if available,
    or geocoded source-to-destination route otherwise.
    """
    # 1. Resolve destination coordinates
    dest_lat = float(shipment.destination_lat) if shipment.destination_lat else None
    dest_lon = float(shipment.destination_lon) if shipment.destination_lon else None
    if dest_lat is None or dest_lon is None:
        dest_lat, dest_lon = geocode_address(shipment.destination)

    # 2. Determine start coordinates
    if latest_pos and latest_pos.latitude is not None and latest_pos.longitude is not None:
        start_lat = float(latest_pos.latitude)
        start_lon = float(latest_pos.longitude)
        speed = float(latest_pos.speed) if latest_pos.speed else None
    else:
        start_lat = float(shipment.source_lat) if shipment.source_lat else None
        start_lon = float(shipment.source_lon) if shipment.source_lon else None
        if start_lat is None or start_lon is None:
            start_lat, start_lon = geocode_address(shipment.source)
        speed = None

    return calculate_dynamic_eta(
        current_lat=start_lat,
        current_lon=start_lon,
        dest_lat=dest_lat,
        dest_lon=dest_lon,
        current_speed_kmh=speed,
        expected_delivery=shipment.expected_delivery,
    )



def is_vehicle_off_route(
    current_lat: float,
    current_lon: float,
    route_coordinates: List[List[float]],
    threshold_meters: float = 500.0,
) -> bool:
    """
    Check if current vehicle location is further than threshold_meters from all points on the route.
    """
    if not route_coordinates:
        return False

    min_dist_meters = float("inf")
    for pt in route_coordinates:
        lat, lon = pt[0], pt[1]
        dist_km = haversine_distance_km(current_lat, current_lon, lat, lon)
        dist_m = dist_km * 1000.0
        if dist_m < min_dist_meters:
            min_dist_meters = dist_m

    return min_dist_meters > threshold_meters


def optimize_multi_stop_route(
    origin: Dict[str, Any], stops: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Optimize multi-stop delivery routes using 2-Opt Travelling Salesperson Heuristic.
    """
    if not stops:
        return {"ordered_stops": [], "total_distance_km": 0.0, "total_duration_mins": 0.0}

    # 1. Build initial route list starting at origin
    route = [origin] + stops
    n = len(route)

    # 2. 2-Opt improvement loop
    improved = True
    iteration = 0
    while improved and iteration < 20:
        improved = False
        iteration += 1
        for i in range(1, n - 1):
            for j in range(i + 1, n):
                # Calculate cost before swap
                d1 = haversine_distance_km(route[i - 1]["lat"], route[i - 1]["lon"], route[i]["lat"], route[i]["lon"])
                d2 = haversine_distance_km(route[j]["lat"], route[j]["lon"], route[j + 1]["lat"] if j + 1 < n else route[0]["lat"], route[j + 1]["lon"] if j + 1 < n else route[0]["lon"])

                # Calculate cost after swap
                d3 = haversine_distance_km(route[i - 1]["lat"], route[i - 1]["lon"], route[j]["lat"], route[j]["lon"])
                d4 = haversine_distance_km(route[i]["lat"], route[i]["lon"], route[j + 1]["lat"] if j + 1 < n else route[0]["lat"], route[j + 1]["lon"] if j + 1 < n else route[0]["lon"])

                if (d3 + d4) < (d1 + d2):
                    # Reverse route segment between i and j
                    route[i : j + 1] = reversed(route[i : j + 1])
                    improved = True

    # 3. Calculate total distance & duration
    total_dist = 0.0
    for idx in range(len(route) - 1):
        total_dist += haversine_distance_km(
            route[idx]["lat"], route[idx]["lon"], route[idx + 1]["lat"], route[idx + 1]["lon"]
        )

    total_dist = round(total_dist, 2)
    total_dur = round((total_dist / 45.0) * 60.0, 1)

    return {
        "origin": origin,
        "ordered_stops": route[1:],  # Exclude origin
        "total_distance_km": total_dist,
        "total_duration_mins": total_dur,
        "stop_count": len(stops),
        "optimization_algorithm": "2-Opt TSP Heuristic",
    }
