import asyncio
import json
import logging
from typing import Any
from fastapi import WebSocket
from starlette.websockets import WebSocketDisconnect

from app.config import settings

logger = logging.getLogger("fleetflow.websocket")


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: list[WebSocket] = []
        self._redis_client = None
        self._pubsub_task: asyncio.Task | None = None
        self._redis_available: bool = False

    async def init_redis(self) -> None:
        """Attempt to initialize Redis pub/sub connection."""
        try:
            import redis.asyncio as aioredis
            self._redis_client = aioredis.from_url(
                settings.REDIS_URL, decode_responses=True, socket_connect_timeout=2.0
            )
            # Test connection
            await self._redis_client.ping()
            self._redis_available = True
            logger.info("Redis Pub/Sub connected successfully.")
            self._pubsub_task = asyncio.create_task(self._listen_redis_channel())
        except Exception as exc:
            self._redis_available = False
            self._redis_client = None
            logger.info(f"Redis not available ({exc}). Falling back to in-memory WebSocket manager.")

    async def _listen_redis_channel(self) -> None:
        """Listen to Redis channel and broadcast to local WebSockets."""
        if not self._redis_client:
            return
        try:
            pubsub = self._redis_client.pubsub()
            await pubsub.subscribe("fleet:gps_channel")
            async for message in pubsub.listen():
                if message["type"] == "message":
                    data = json.loads(message["data"])
                    await self._local_broadcast(data)
        except asyncio.CancelledError:
            pass
        except Exception as exc:
            logger.warning(f"Redis listener encountered error: {exc}")

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket client connected. Total clients: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket client disconnected. Remaining: {len(self.active_connections)}")

    async def send_personal_message(self, message: dict[str, Any], websocket: WebSocket) -> None:
        try:
            await websocket.send_text(json.dumps(message))
        except Exception:
            self.disconnect(websocket)

    async def _local_broadcast(self, message: dict[str, Any]) -> None:
        """Send to all connected local WebSocket clients."""
        payload = json.dumps(message)
        stale: list[WebSocket] = []
        for connection in list(self.active_connections):
            try:
                await connection.send_text(payload)
            except (WebSocketDisconnect, RuntimeError, Exception):
                stale.append(connection)
        for dead in stale:
            self.disconnect(dead)

    async def broadcast(self, message: dict[str, Any]) -> None:
        """Broadcasts to all WebSocket clients via Redis or in-memory fallback."""
        if self._redis_available and self._redis_client:
            try:
                await self._redis_client.publish("fleet:gps_channel", json.dumps(message))
                return
            except Exception as exc:
                logger.warning(f"Redis publish failed ({exc}), falling back to direct broadcast.")
        
        await self._local_broadcast(message)


manager = ConnectionManager()
