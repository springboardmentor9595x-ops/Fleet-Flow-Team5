"""
WebSocket endpoint for real-time GPS tracking.

Flow:
  1. Client (driver app or dashboard) connects to WS /ws/tracking/{vehicle_id}
  2. Driver clients send GPS pings as JSON: { lat, lon, speed, heading, ... }
  3. Server stores ping in DB, publishes to Redis/in-process channel
  4. Dashboard clients receive live location broadcasts
  5. On each ping, geofence detection runs and emits an event if vehicle arrived
"""
import json
import asyncio
import logging
from datetime import datetime
from typing import Dict, Set
from uuid import UUID

from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.core.redis import publish_location, subscribe_in_process, unsubscribe_in_process, is_redis_available
from app.crud.gps import create_gps_ping
from app.crud.shipment import get_shipments_by_vehicle
from app.schemas.gps import GPSPingIn
from app.database import SessionLocal
from app.models.shipment import ShipmentStatusEnum

logger = logging.getLogger(__name__)

# Active WebSocket connections: vehicle_id -> set of WebSocket connections
_active_connections: Dict[str, Set[WebSocket]] = {}

GEOFENCE_RADIUS_METERS = 500  # arrival detection radius


def _haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in meters between two GPS coordinates."""
    import math
    R = 6371000  # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _check_geofence(vehicle_id: str, lat: float, lon: float, db: Session):
    """Check if vehicle has entered any shipment destination geofence."""
    try:
        from uuid import UUID as _UUID
        vid = _UUID(vehicle_id)
        shipments = get_shipments_by_vehicle(db, vid)
        events = []
        for s in shipments:
            if s.status not in (ShipmentStatusEnum.InTransit, ShipmentStatusEnum.Assigned):
                continue
            if s.destination_lat is None or s.destination_lon is None:
                continue
            dist = _haversine_distance(lat, lon, float(s.destination_lat), float(s.destination_lon))
            if dist <= GEOFENCE_RADIUS_METERS:
                events.append({
                    "type": "geofence_event",
                    "event": "arrived_at_destination",
                    "vehicle_id": vehicle_id,
                    "shipment_id": str(s.shipment_id),
                    "tracking_number": s.tracking_number,
                    "destination": s.destination,
                    "distance_meters": round(dist, 1),
                    "timestamp": datetime.utcnow().isoformat(),
                })
        return events
    except Exception as exc:
        logger.warning("Geofence check error: %s", exc)
        return []


async def _broadcast_to_vehicle_ws(vehicle_id: str, message: dict):
    """Send message to all WebSocket clients watching this vehicle."""
    connections = _active_connections.get(vehicle_id, set())
    dead = set()
    payload = json.dumps(message, default=str)
    for ws in connections:
        try:
            await ws.send_text(payload)
        except Exception:
            dead.add(ws)
    for ws in dead:
        connections.discard(ws)


async def connect_vehicle(vehicle_id: str, websocket: WebSocket):
    """Register a WebSocket as subscribed to a vehicle's updates."""
    await websocket.accept()
    _active_connections.setdefault(vehicle_id, set()).add(websocket)
    logger.info("WS connected: vehicle=%s total_subs=%d", vehicle_id, len(_active_connections[vehicle_id]))


def disconnect_vehicle(vehicle_id: str, websocket: WebSocket):
    """Clean up a disconnected WebSocket."""
    subs = _active_connections.get(vehicle_id)
    if subs:
        subs.discard(websocket)
        if not subs:
            del _active_connections[vehicle_id]
    logger.info("WS disconnected: vehicle=%s", vehicle_id)


async def handle_tracking_websocket(vehicle_id: str, websocket: WebSocket):
    """
    Main WebSocket handler.
    - Accepts GPS pings from driver clients (JSON with lat/lon/speed/heading)
    - Broadcasts location updates to all subscribers of this vehicle
    - Handles in-process or Redis-based fanout
    - Detects geofence events
    """
    await connect_vehicle(vehicle_id, websocket)

    # Register in-process broadcast callback (for non-Redis mode)
    async def _broadcast_callback(data: dict):
        await _broadcast_to_vehicle_ws(vehicle_id, data)

    if not is_redis_available():
        subscribe_in_process(vehicle_id, _broadcast_callback)

    db: Session = SessionLocal()
    try:
        # Send a welcome/sync message
        await websocket.send_text(json.dumps({
            "type": "connected",
            "vehicle_id": vehicle_id,
            "message": "Real-time tracking active",
            "timestamp": datetime.utcnow().isoformat(),
        }))

        while True:
            try:
                raw = await asyncio.wait_for(websocket.receive_text(), timeout=60.0)
            except asyncio.TimeoutError:
                # Send a ping to keep the connection alive
                try:
                    await websocket.send_text(json.dumps({"type": "ping"}))
                except Exception:
                    break
                continue

            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({"type": "error", "detail": "Invalid JSON"}))
                continue

            msg_type = payload.get("type", "location_ping")

            if msg_type == "pong":
                continue

            if msg_type in ("location_ping", "location_update") or "latitude" in payload:
                # Driver is sending a GPS update
                try:
                    ping_data = GPSPingIn(
                        latitude=payload["latitude"],
                        longitude=payload["longitude"],
                        speed=payload.get("speed"),
                        heading=payload.get("heading"),
                        altitude=payload.get("altitude"),
                        accuracy=payload.get("accuracy"),
                    )
                    # Persist to DB
                    try:
                        uuid_vid = UUID(vehicle_id)
                        create_gps_ping(db, uuid_vid, ping_data)
                    except Exception as db_err:
                        logger.warning("GPS DB save failed: %s", db_err)

                    # Check geofences
                    geofence_events = _check_geofence(
                        vehicle_id,
                        float(ping_data.latitude),
                        float(ping_data.longitude),
                        db,
                    )

                    # Compute dynamic ETA telemetry
                    eta_telemetry = None
                    try:
                        from app.core.route_optimization import calculate_dynamic_eta
                        from uuid import UUID as _UUID
                        linked_ships = get_shipments_by_vehicle(db, _UUID(vehicle_id))
                        active_ships = [s for s in linked_ships if s.status in (ShipmentStatusEnum.InTransit, ShipmentStatusEnum.Assigned)]
                        if active_ships:
                            target_s = active_ships[0]
                            dest_lat = float(target_s.destination_lat) if target_s.destination_lat else 19.0760
                            dest_lon = float(target_s.destination_lon) if target_s.destination_lon else 72.8777
                            eta_telemetry = calculate_dynamic_eta(
                                current_lat=float(ping_data.latitude),
                                current_lon=float(ping_data.longitude),
                                dest_lat=dest_lat,
                                dest_lon=dest_lon,
                                current_speed_kmh=float(ping_data.speed) if ping_data.speed else None,
                                expected_delivery=target_s.expected_delivery,
                            )
                    except Exception as eta_err:
                        logger.warning("WS ETA error: %s", eta_err)

                    # Build broadcast message
                    broadcast = {
                        "type": "location_update",
                        "vehicle_id": vehicle_id,
                        "latitude": float(ping_data.latitude),
                        "longitude": float(ping_data.longitude),
                        "speed": float(ping_data.speed) if ping_data.speed else None,
                        "heading": float(ping_data.heading) if ping_data.heading else None,
                        "timestamp": datetime.utcnow().isoformat(),
                        "eta_telemetry": eta_telemetry,
                    }

                    # Publish via Redis or in-process
                    await publish_location(vehicle_id, broadcast)

                    # Also broadcast geofence events if any
                    for ev in geofence_events:
                        await publish_location(vehicle_id, ev)

                    # Confirm receipt to sender
                    await websocket.send_text(json.dumps({"type": "ack", "timestamp": datetime.utcnow().isoformat()}))

                except (KeyError, ValueError) as e:
                    await websocket.send_text(json.dumps({
                        "type": "error",
                        "detail": f"Invalid location data: {e}"
                    }))

            elif msg_type == "subscribe":
                # This client wants to receive updates (dashboard mode)
                await websocket.send_text(json.dumps({
                    "type": "subscribed",
                    "vehicle_id": vehicle_id,
                }))

    except WebSocketDisconnect:
        logger.info("WS client disconnected cleanly: vehicle=%s", vehicle_id)
    except Exception as exc:
        logger.error("WS handler error for vehicle=%s: %s", vehicle_id, exc)
    finally:
        disconnect_vehicle(vehicle_id, websocket)
        if not is_redis_available():
            unsubscribe_in_process(vehicle_id, _broadcast_callback)
        db.close()
