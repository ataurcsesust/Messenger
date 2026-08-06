from datetime import datetime, timezone
from typing import List
from uuid import UUID

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.middleware.error_handlers import ConflictError, ForbiddenError, NotFoundError, ValidationAppError
from app.models.call import Call
from app.models.enums import CallStatus
from app.models.user import BlockedUser, User
from app.services import conversation_service
from app.websocket.manager import manager

ACTIVE_STATUSES = (CallStatus.RINGING, CallStatus.ONGOING)


async def _is_blocked(db: AsyncSession, user_a: UUID, user_b: UUID) -> bool:
    result = await db.execute(
        select(BlockedUser).where(
            or_(
                and_(BlockedUser.blocker_id == user_a, BlockedUser.blocked_id == user_b),
                and_(BlockedUser.blocker_id == user_b, BlockedUser.blocked_id == user_a),
            )
        )
    )
    return result.scalar_one_or_none() is not None


async def _has_active_call(db: AsyncSession, user_id: UUID) -> bool:
    result = await db.execute(
        select(Call).where(
            or_(Call.caller_id == user_id, Call.callee_id == user_id),
            Call.status.in_(ACTIVE_STATUSES),
        )
    )
    return result.scalar_one_or_none() is not None


async def initiate_call(db: AsyncSession, caller: User, callee_id: UUID) -> Call:
    if callee_id == caller.id:
        raise ValidationAppError("You can't call yourself")

    callee_result = await db.execute(select(User).where(User.id == callee_id, User.is_active.is_(True)))
    callee = callee_result.scalar_one_or_none()
    if callee is None:
        raise NotFoundError("User not found")

    if await _is_blocked(db, caller.id, callee_id):
        raise ForbiddenError("You can't call this user")

    # Idempotent retry check: if caller already initiated a ringing call to this callee, return it.
    existing_call_res = await db.execute(
        select(Call).where(
            Call.caller_id == caller.id,
            Call.callee_id == callee_id,
            Call.status == CallStatus.RINGING,
        )
    )
    existing_call = existing_call_res.scalar_one_or_none()
    if existing_call is not None:
        conversation = await conversation_service.get_or_create_direct_conversation(db, caller, callee_id)
        await manager.send_to_user(
            callee_id,
            {
                "type": "incoming_call",
                "call_id": str(existing_call.id),
                "conversation_id": str(conversation.id),
                "caller": {
                    "id": str(caller.id),
                    "username": caller.username,
                    "full_name": caller.full_name,
                    "avatar_url": caller.avatar_url,
                },
            },
        )
        return existing_call

    if not manager.is_online(callee_id):
        raise ConflictError("This user is currently offline and can't be called")

    if await _has_active_call(db, callee_id):
        raise ConflictError("This user is already on another call")
    if await _has_active_call(db, caller.id):
        raise ConflictError("You're already on another call")

    conversation = await conversation_service.get_or_create_direct_conversation(db, caller, callee_id)

    call = Call(conversation_id=conversation.id, caller_id=caller.id, callee_id=callee_id, status=CallStatus.RINGING)
    db.add(call)
    await db.commit()
    await db.refresh(call)

    await manager.send_to_user(
        callee_id,
        {
            "type": "incoming_call",
            "call_id": str(call.id),
            "conversation_id": str(conversation.id),
            "caller": {
                "id": str(caller.id),
                "username": caller.username,
                "full_name": caller.full_name,
                "avatar_url": caller.avatar_url,
            },
        },
    )
    return call


async def _get_call_or_404(db: AsyncSession, call_id: UUID) -> Call:
    call = await db.get(Call, call_id)
    if call is None:
        raise NotFoundError("Call not found")
    return call


async def accept_call(db: AsyncSession, call_id: UUID, user_id: UUID) -> Call:
    call = await _get_call_or_404(db, call_id)
    if call.callee_id != user_id:
        raise ForbiddenError("Only the callee can accept this call")
    if call.status != CallStatus.RINGING:
        raise ConflictError(f"Call is no longer ringing (status: {call.status.value})")

    call.status = CallStatus.ONGOING
    call.answered_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(call)

    await manager.send_to_user(call.caller_id, {"type": "call_accepted", "call_id": str(call.id)})
    return call


async def reject_call(db: AsyncSession, call_id: UUID, user_id: UUID) -> Call:
    call = await _get_call_or_404(db, call_id)
    if call.callee_id != user_id:
        raise ForbiddenError("Only the callee can reject this call")
    if call.status != CallStatus.RINGING:
        raise ConflictError(f"Call is no longer ringing (status: {call.status.value})")

    call.status = CallStatus.REJECTED
    call.ended_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(call)

    await manager.send_to_user(call.caller_id, {"type": "call_rejected", "call_id": str(call.id)})
    return call


async def end_call(db: AsyncSession, call_id: UUID, user_id: UUID) -> Call:
    call = await _get_call_or_404(db, call_id)
    if user_id not in (call.caller_id, call.callee_id):
        raise ForbiddenError("You're not a participant in this call")
    if call.status not in ACTIVE_STATUSES:
        # Already ended by the other party or timed out — idempotent no-op.
        return call

    now = datetime.now(timezone.utc)
    if call.status == CallStatus.RINGING:
        # Never answered: caller hanging up -> cancelled; if somehow the
        # callee ends an unanswered call, treat it the same way.
        call.status = CallStatus.CANCELLED
    else:
        call.status = CallStatus.COMPLETED
        if call.answered_at:
            call.duration_seconds = int((now - call.answered_at).total_seconds())

    call.ended_at = now
    await db.commit()
    await db.refresh(call)

    other_id = call.callee_id if user_id == call.caller_id else call.caller_id
    await manager.send_to_user(other_id, {"type": "call_ended", "call_id": str(call.id), "status": call.status.value})
    return call


async def mark_missed_if_stale(db: AsyncSession, call_id: UUID) -> None:
    """Called by the server-side ring timeout — marks an unanswered call missed."""
    call = await db.get(Call, call_id)
    if call is None or call.status != CallStatus.RINGING:
        return
    call.status = CallStatus.MISSED
    call.ended_at = datetime.now(timezone.utc)
    await db.commit()
    await manager.send_to_user(call.caller_id, {"type": "call_ended", "call_id": str(call.id), "status": "missed"})
    await manager.send_to_user(call.callee_id, {"type": "call_ended", "call_id": str(call.id), "status": "missed"})


async def list_call_history(db: AsyncSession, user_id: UUID, limit: int = 30, offset: int = 0) -> List[dict]:
    result = await db.execute(
        select(Call)
        .where(or_(Call.caller_id == user_id, Call.callee_id == user_id))
        .options(selectinload(Call.caller), selectinload(Call.callee))
        .order_by(Call.started_at.desc())
        .offset(offset)
        .limit(limit)
    )
    calls = result.scalars().all()
    items = []
    for call in calls:
        is_outgoing = call.caller_id == user_id
        other_user = call.callee if is_outgoing else call.caller
        items.append(
            {
                "id": call.id,
                "status": call.status,
                "started_at": call.started_at,
                "ended_at": call.ended_at,
                "duration_seconds": call.duration_seconds,
                "is_outgoing": is_outgoing,
                "other_user": other_user,
            }
        )
    return items


async def get_call_for_user(db: AsyncSession, call_id: UUID, user_id: UUID) -> Call:
    call = await _get_call_or_404(db, call_id)
    if user_id not in (call.caller_id, call.callee_id):
        raise ForbiddenError("You're not a participant in this call")
    return call
