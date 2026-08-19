"""
In-memory WebSocket connection registry.

Maps user_id -> set of active WebSocket connections (a user may have
multiple tabs/devices open). This is process-local; if the app is ever
scaled to multiple server processes, this should be backed by Redis
pub/sub instead so broadcasts reach users connected to a different
process. Kept simple here since that's an infra concern, not a
correctness one for a single-process deployment.
"""
import json
import logging
from typing import Dict, Set
from uuid import UUID

from fastapi import WebSocket

logger = logging.getLogger("messenger.websocket")


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: Dict[UUID, Set[WebSocket]] = {}

    async def connect(self, user_id: UUID, websocket: WebSocket) -> None:
        self._connections.setdefault(user_id, set()).add(websocket)
        logger.info("User %s connected (%d active sockets)", user_id, len(self._connections[user_id]))


    def disconnect(self, user_id: UUID, websocket: WebSocket) -> None:
        sockets = self._connections.get(user_id)
        if sockets is None:
            return
        sockets.discard(websocket)
        if not sockets:
            del self._connections[user_id]

    def is_online(self, user_id: UUID) -> bool:
        return user_id in self._connections and len(self._connections[user_id]) > 0

    async def send_to_user(self, user_id: UUID, event: dict) -> None:
        """Send an event to all of a single user's active connections."""
        sockets = list(self._connections.get(user_id, ()))
        payload = json.dumps(event, default=str)
        for ws in sockets:
            try:
                await ws.send_text(payload)
            except Exception:
                logger.warning("Failed to send to a socket for user %s; dropping it", user_id)
                self.disconnect(user_id, ws)

    async def send_to_users(self, user_ids, event: dict) -> None:
        """Broadcast an event to multiple users (e.g. all members of a conversation)."""
        for user_id in user_ids:
            await self.send_to_user(user_id, event)


# Single process-wide instance, imported by both the WS route and REST
# routers/services that need to push real-time events after a DB write.
manager = ConnectionManager()
