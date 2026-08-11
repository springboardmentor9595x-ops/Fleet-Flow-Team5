"""
Redis & In-Process Pub/Sub and Caching Layer.
Used for real-time location streaming and OSRM route/geocoding caching.
"""
import json
import asyncio
import logging
from typing import Dict, Set, Callable, Awaitable, Optional, Any
from datetime import datetime, timedelta

from app.config import settings

logger = logging.getLogger(__name__)

# Redis global connection client (None if unavailable)
_redis_client = None
_redis_checked = False

# In-process callback registry: vehicle_id -> Set[Callable[[dict], Awaitable[None]]]
_in_process_subscribers: Dict[str, Set[Callable[[dict], Awaitable[None]]]] = {}

# Simple in-process cache fallback for routes: key -> (value, expiry_timestamp)
_in_process_cache: Dict[str, tuple] = {}


def get_redis_client():
    """Attempt connection to Redis if configured and installed."""
    global _redis_client, _redis_checked
    if _redis_checked:
        return _redis_client

    _redis_checked = True
    if not settings.REDIS_URL:
        logger.info("REDIS_URL not configured. Using in-process pub/sub and memory cache.")
        return None

    try:
        import redis.asyncio as aioredis
        client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        # Test ping asynchronously via loop or synchronous check
        _redis_client = client
        logger.info("Connected to Redis at %s", settings.REDIS_URL)
        return _redis_client
    except Exception as exc:
        logger.warning("Redis connection failed (%s). Falling back to in-process memory cache.", exc)
        _redis_client = None
        return None


def is_redis_available() -> bool:
    client = get_redis_client()
    return client is not None


def subscribe_in_process(vehicle_id: str, callback: Callable[[dict], Awaitable[None]]):
    """Register an in-process async callback for vehicle location updates."""
    _in_process_subscribers.setdefault(vehicle_id, set()).add(callback)


def unsubscribe_in_process(vehicle_id: str, callback: Callable[[dict], Awaitable[None]]):
    """Unregister an in-process callback."""
    subs = _in_process_subscribers.get(vehicle_id)
    if subs:
        subs.discard(callback)
        if not subs:
            del _in_process_subscribers[vehicle_id]


async def publish_location(vehicle_id: str, data: dict):
    """
    Publish location payload to vehicle channel.
    Uses Redis Pub/Sub if available, otherwise invokes registered in-process callbacks.
    """
    client = get_redis_client()
    if client:
        try:
            channel = f"vehicle_tracking:{vehicle_id}"
            await client.publish(channel, json.dumps(data, default=str))
        except Exception as exc:
            logger.warning("Redis publish error: %s. Using in-process fallback.", exc)
            await _publish_in_process(vehicle_id, data)
    else:
        await _publish_in_process(vehicle_id, data)


async def _publish_in_process(vehicle_id: str, data: dict):
    callbacks = list(_in_process_subscribers.get(vehicle_id, []))
    for cb in callbacks:
        try:
            await cb(data)
        except Exception as exc:
            logger.warning("In-process WS callback error: %s", exc)


def cache_get(key: str) -> Optional[Any]:
    """Retrieve value from in-process cache if not expired."""
    item = _in_process_cache.get(key)
    if not item:
        return None
    val, expiry = item
    if datetime.utcnow() > expiry:
        del _in_process_cache[key]
        return None
    return val


def cache_set(key: str, value: Any, ttl_seconds: int = 600):
    """Store value in in-process cache with TTL (seconds)."""
    expiry = datetime.utcnow() + timedelta(seconds=ttl_seconds)
    _in_process_cache[key] = (value, expiry)
