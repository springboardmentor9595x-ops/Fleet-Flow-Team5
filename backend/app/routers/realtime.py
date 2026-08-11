import json
import logging
from datetime import datetime, timezone
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.core.security import ALGORITHM, SECRET_KEY
from app.crud import gps as gps_crud
from app.crud import shipment as shipment_crud
from app.crud import trip as trip_crud
from app.models.gps_tracking import GPSTracking
from app.models.user import User
from app.models.vehicle import Vehicle
from app.schemas.gps import GPSLocationRead, GPSPing
from app.services.routing_service import check_geofence_arrival, compute_live_eta
from app.utils.ws_manager import manager

logger = logging.getLogger("fleetflow.realtime")
router = APIRouter(tags=["realtime"])


def authenticate_ws_token(token: str | None, db: Session) -> User | None:
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if not email:
            return None
        return db.query(User).filter(User.email == email.lower()).first()
    except JWTError:
        return None


async def handle_incoming_gps_data(raw_data: dict, db: Session) -> dict:
    """Processes incoming GPS ping, stores it in DB, performs geofencing and ETA."""
    try:
        vehicle_id_str = raw_data.get("vehicle_id")
        lat = float(raw_data["latitude"])
        lng = float(raw_data["longitude"])
        speed = float(raw_data.get("speed", 0.0))
        heading = float(raw_data.get("heading", 0.0))
        shipment_id_str = raw_data.get("shipment_id")
        trip_id_str = raw_data.get("trip_id")

        vehicle_id = UUID(vehicle_id_str) if vehicle_id_str else None
        shipment_id = UUID(shipment_id_str) if shipment_id_str else None
        trip_id = UUID(trip_id_str) if trip_id_str else None

        # 1. Record to database if vehicle_id exists
        if vehicle_id:
            db_ping = GPSTracking(
                vehicle_id=vehicle_id,
                latitude=lat,
                longitude=lng,
                speed=speed,
                heading=heading,
                recorded_time=datetime.now(timezone.utc),
            )
            db.add(db_ping)
            db.commit()

        # 2. Check active trip or shipment destination for geofencing and ETA
        eta_info = None
        geofence_event = None

        target_lat, target_lng = None, None
        if trip_id:
            trip = trip_crud.get_trip_by_id(db, trip_id)
            if trip:
                target_lat, target_lng = trip.dest_lat, trip.dest_lng
        elif shipment_id:
            shipment = shipment_crud.get_shipment_by_id(db, shipment_id)
            if shipment:
                target_lat, target_lng = shipment.dest_lat, shipment.dest_lng

        if target_lat is not None and target_lng is not None:
            # Dynamic Live ETA calculation
            eta_info = compute_live_eta(lat, lng, target_lat, target_lng, speed)

            # Geofence detection (arrival within 200 meters)
            arrived = check_geofence_arrival(lat, lng, target_lat, target_lng, threshold_meters=250.0)
            if arrived:
                geofence_event = {
                    "event_type": "arrived_destination",
                    "message": f"Vehicle {vehicle_id_str or ''} has arrived at destination geofence zone.",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
                # Log geofence event (replaces email/SMS console output)
                logger.info(f"GEOFENCE ALERT: {geofence_event['message']}")

        # 3. Formulate unified broadcast message
        broadcast_msg = {
            "type": "location_update",
            "data": {
                "vehicle_id": vehicle_id_str,
                "shipment_id": shipment_id_str,
                "trip_id": trip_id_str,
                "latitude": lat,
                "longitude": lng,
                "speed": speed,
                "heading": heading,
                "status": raw_data.get("status", "In Transit"),
                "eta": eta_info,
                "geofence": geofence_event,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        }

        # 4. Broadcast via Redis / in-memory manager
        await manager.broadcast(broadcast_msg)
        return broadcast_msg["data"]
    except Exception as exc:
        logger.error(f"Error handling GPS data: {exc}")
        return raw_data


@router.websocket("/location")
@router.websocket("/ws/gps")
async def websocket_gps_endpoint(websocket: WebSocket, db: Session = Depends(get_db)):
    """Live WebSocket streaming endpoint for GPS pings and client tracking subscribers."""
    token = websocket.query_params.get("token")
    user = authenticate_ws_token(token, db)
    # Connect client
    await manager.connect(websocket)

    try:
        while True:
            text_data = await websocket.receive_text()
            if not text_data:
                continue
            try:
                payload = json.loads(text_data)
                # If it's a ping message from vehicle/driver client
                if isinstance(payload, dict):
                    if payload.get("type") == "ping" or "latitude" in payload:
                        data = payload.get("data", payload)
                        await handle_incoming_gps_data(data, db)
                    elif payload.get("type") == "heartbeat":
                        await websocket.send_text(json.dumps({"type": "heartbeat_ack"}))
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as exc:
        logger.warning(f"WebSocket closed with exception: {exc}")
        manager.disconnect(websocket)


@router.post("/simulate-ping")
async def simulate_gps_ping(
    ping: GPSPing,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """REST endpoint to simulate or ingest vehicle GPS coordinates."""
    data = await handle_incoming_gps_data(ping.model_dump(mode="json"), db)
    return {"message": "GPS ping processed and broadcasted", "data": data}


@router.get("/latest-locations")
def get_latest_vehicle_locations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    """Retrieve the latest GPS position for all fleet vehicles."""
    return gps_crud.get_latest_locations_for_all_vehicles(db)


@router.get("/vehicles/{vehicle_id}/history", response_model=list[GPSLocationRead])
def get_vehicle_tracking_history(
    vehicle_id: UUID,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[GPSLocationRead]:
    """Get recent GPS trail coordinates for a vehicle."""
    records = gps_crud.get_vehicle_location_history(db, vehicle_id, limit=limit)
    return [GPSLocationRead(
        tracking_id=r.tracking_id,
        vehicle_id=r.vehicle_id,
        latitude=r.latitude,
        longitude=r.longitude,
        speed=r.speed,
        heading=r.heading,
        recorded_time=r.recorded_time,
    ) for r in records]
