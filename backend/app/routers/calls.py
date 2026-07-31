from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.schemas.call import CallHistoryItem, CallOut, InitiateCallRequest
from app.services import call_service

router = APIRouter(prefix="/calls", tags=["Calls"])


@router.post("", response_model=CallOut, status_code=201)
async def initiate_call(
    payload: InitiateCallRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Start a 1:1 voice call. Creates a call record (status=ringing) and
    pushes an `incoming_call` event to the callee over WebSocket. Fails
    with 409 if the callee is offline, already on a call, or you already
    are; fails with 403 if either of you has blocked the other.
    """
    return await call_service.initiate_call(db, current_user, payload.callee_id)


@router.post("/{call_id}/accept", response_model=CallOut)
async def accept_call(
    call_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Callee accepts an incoming call. Notifies the caller over WebSocket."""
    return await call_service.accept_call(db, call_id, current_user.id)


@router.post("/{call_id}/reject", response_model=CallOut)
async def reject_call(
    call_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Callee declines an incoming call. Notifies the caller over WebSocket."""
    return await call_service.reject_call(db, call_id, current_user.id)


@router.post("/{call_id}/end", response_model=CallOut)
async def end_call(
    call_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Either participant hangs up. Computes and stores call duration if the
    call had been answered; marks it cancelled if it was ended before
    being answered. Notifies the other participant over WebSocket.
    """
    return await call_service.end_call(db, call_id, current_user.id)


@router.get("", response_model=List[CallHistoryItem])
async def call_history(
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Call history for the current user, most recent first."""
    return await call_service.list_call_history(db, current_user.id, limit, offset)


@router.get("/{call_id}", response_model=CallOut)
async def get_call(
    call_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetch a single call's current state (used to recover after a page reload mid-call)."""
    return await call_service.get_call_for_user(db, call_id, current_user.id)
