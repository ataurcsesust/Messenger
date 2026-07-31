from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.conversation import (
    AddMembersRequest,
    ConversationListItem,
    ConversationMemberOut,
    ConversationOut,
    CreateDirectConversationRequest,
    CreateGroupRequest,
    UpdateGroupRequest,
    UpdateMemberRoleRequest,
)
from app.services import conversation_service

router = APIRouter(prefix="/conversations", tags=["Conversations"])


@router.get("/{conversation_id}/members", response_model=List[ConversationMemberOut])
async def list_members(
    conversation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all active members of a conversation (must be a member yourself)."""
    return await conversation_service.list_members(db, conversation_id, current_user.id)


@router.get("", response_model=List[ConversationListItem])
async def list_my_conversations(
    include_archived: bool = Query(default=False),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """The chat list: all conversations, sorted pinned-first then most recently active."""
    return await conversation_service.list_conversations(db, current_user.id, include_archived)


@router.post("/direct", response_model=ConversationOut, status_code=201)
async def create_direct_conversation(
    payload: CreateDirectConversationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Start (or reuse) a 1:1 conversation with another user."""
    return await conversation_service.get_or_create_direct_conversation(db, current_user, payload.user_id)


@router.post("/group", response_model=ConversationOut, status_code=201)
async def create_group(
    payload: CreateGroupRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new group chat with the current user as owner."""
    return await conversation_service.create_group(db, current_user, payload.name, payload.description, payload.member_ids)


@router.patch("/{conversation_id}", response_model=ConversationOut)
async def update_group(
    conversation_id: UUID,
    payload: UpdateGroupRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a group's name/description (admins only)."""
    return await conversation_service.update_group_info(db, conversation_id, current_user.id, payload.name, payload.description)


@router.post("/{conversation_id}/members", response_model=MessageResponse)
async def add_members(
    conversation_id: UUID,
    payload: AddMembersRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add members to a group (admins only)."""
    await conversation_service.add_members(db, conversation_id, current_user.id, payload.member_ids)
    return MessageResponse(message="Members added")


@router.delete("/{conversation_id}/members/{member_id}", response_model=MessageResponse)
async def remove_member(
    conversation_id: UUID,
    member_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a member from a group, or leave the group yourself."""
    await conversation_service.remove_member(db, conversation_id, current_user.id, member_id)
    return MessageResponse(message="Member removed")


@router.patch("/{conversation_id}/members/{member_id}/role", response_model=MessageResponse)
async def update_member_role(
    conversation_id: UUID,
    member_id: UUID,
    payload: UpdateMemberRoleRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Promote/demote a group member's role (owner only)."""
    await conversation_service.update_member_role(db, conversation_id, current_user.id, member_id, payload.role)
    return MessageResponse(message="Role updated")


@router.post("/{conversation_id}/mute", response_model=MessageResponse)
async def mute_conversation(
    conversation_id: UUID,
    muted: bool = Query(default=True),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await conversation_service.set_member_flag(db, conversation_id, current_user.id, muted=muted)
    return MessageResponse(message="Mute setting updated")


@router.post("/{conversation_id}/archive", response_model=MessageResponse)
async def archive_conversation(
    conversation_id: UUID,
    archived: bool = Query(default=True),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await conversation_service.set_member_flag(db, conversation_id, current_user.id, archived=archived)
    return MessageResponse(message="Archive setting updated")


@router.post("/{conversation_id}/pin", response_model=MessageResponse)
async def pin_conversation(
    conversation_id: UUID,
    pinned: bool = Query(default=True),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await conversation_service.set_member_flag(db, conversation_id, current_user.id, pinned=pinned)
    return MessageResponse(message="Pin setting updated")


@router.post("/{conversation_id}/read", response_model=MessageResponse)
async def mark_conversation_read(
    conversation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark all messages in this conversation as read by the current user."""
    from app.services import message_service

    await message_service.mark_conversation_read(db, conversation_id, current_user.id)
    return MessageResponse(message="Marked as read")
