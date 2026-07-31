import json
import logging
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from jose import JWTError
from sqlalchemy import or_, select

from app.auth.security import decode_access_token
from app.database.session import AsyncSessionLocal
from app.models.call import Call
from app.models.conversation import ConversationMember
from app.models.enums import CallStatus
from app.models.user import User
from app.services import call_service, conversation_service
from app.websocket.manager import manager

router = APIRouter()
logger = logging.getLogger("messenger.websocket")


async def _authenticate(token: str):
    """Validate the JWT passed as a query param and load the user (fresh session)."""
    try:
        payload = decode_access_token(token)
        user_id = UUID(payload["sub"])
    except (JWTError, KeyError, ValueError):
        return None

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user is None or not user.is_active:
            return None
        return user


async def _contacts_of(user_id: UUID):
    """All other users who share at least one conversation with this user — presence updates go only to them."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(ConversationMember.conversation_id).where(ConversationMember.user_id == user_id)
        )
        conv_ids = [row[0] for row in result.all()]
        if not conv_ids:
            return []
        result = await db.execute(
            select(ConversationMember.user_id.distinct()).where(
                ConversationMember.conversation_id.in_(conv_ids), ConversationMember.user_id != user_id
            )
        )
        return [row[0] for row in result.all()]


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str):
    """
    Real-time channel. Connect with `ws://host/ws?token=<access_token>`.

    Server -> client events: new_message, message_edited, message_deleted,
    message_reaction, message_pinned, messages_read, presence_update, typing,
    incoming_call, call_accepted, call_rejected, call_ended, call_offer,
    call_answer, call_ice_candidate (the last three are pure WebRTC relay).
    Client -> server events: {"type": "typing", "conversation_id": "..."},
    {"type": "stop_typing", "conversation_id": "..."}, and the WebRTC relay
    triggers {"type": "call_offer"|"call_answer"|"call_ice_candidate",
    "target_user_id": "...", ...sdp/candidate payload} — the server
    forwards these verbatim to target_user_id without inspecting them.
    """
    user = await _authenticate(token)
    if user is None:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    await manager.connect(user.id, websocket)

    # Mark online + notify contacts, but only the first connection for this user matters.
    async with AsyncSessionLocal() as db:
        db_user = await db.get(User, user.id)
        db_user.is_online = True
        db_user.last_seen = datetime.now(timezone.utc)
        await db.commit()

    contacts = await _contacts_of(user.id)
    await manager.send_to_users(
        contacts, {"type": "presence_update", "user_id": str(user.id), "is_online": True}
    )

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue

            event_type = data.get("type")
            conversation_id = data.get("conversation_id")

            if event_type in ("typing", "stop_typing") and conversation_id:
                async with AsyncSessionLocal() as db:
                    member_ids = await conversation_service.get_member_user_ids(db, UUID(conversation_id))
                others = [uid for uid in member_ids if uid != user.id]
                await manager.send_to_users(
                    others,
                    {
                        "type": event_type,
                        "conversation_id": conversation_id,
                        "user_id": str(user.id),
                    },
                )
            elif event_type in ("call_offer", "call_answer", "call_ice_candidate"):
                # Pure relay: the server never inspects or stores SDP/ICE
                # payloads, it just forwards them to the named target.
                target_user_id = data.get("target_user_id")
                if not target_user_id:
                    continue
                relay = {**data, "from_user_id": str(user.id)}
                await manager.send_to_user(UUID(target_user_id), relay)
            elif event_type == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))

    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception("WebSocket error for user %s", user.id)
    finally:
        manager.disconnect(user.id, websocket)
        if not manager.is_online(user.id):
            async with AsyncSessionLocal() as db:
                db_user = await db.get(User, user.id)
                db_user.is_online = False
                db_user.last_seen = datetime.now(timezone.utc)
                await db.commit()

                # If this user drops off mid-call, end it so the other
                # party isn't left ringing/connected to a dead peer.
                result = await db.execute(
                    select(Call).where(
                        or_(Call.caller_id == user.id, Call.callee_id == user.id),
                        Call.status.in_((CallStatus.RINGING, CallStatus.ONGOING)),
                    )
                )
                for call in result.scalars().all():
                    await call_service.end_call(db, call.id, user.id)

            await manager.send_to_users(
                contacts, {"type": "presence_update", "user_id": str(user.id), "is_online": False}
            )
