from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.middleware.error_handlers import ConflictError, ForbiddenError, NotFoundError
from app.models.conversation import Conversation, ConversationMember
from app.models.enums import MemberRole
from app.models.message import Message
from app.models.user import User


async def get_membership(db: AsyncSession, conversation_id: UUID, user_id: UUID) -> Optional[ConversationMember]:
    result = await db.execute(
        select(ConversationMember).where(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id == user_id,
            ConversationMember.left_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def require_membership(db: AsyncSession, conversation_id: UUID, user_id: UUID) -> ConversationMember:
    membership = await get_membership(db, conversation_id, user_id)
    if membership is None:
        raise NotFoundError("Conversation not found")
    return membership


async def get_or_create_direct_conversation(db: AsyncSession, user_a: User, other_user_id: UUID) -> Conversation:
    if user_a.id == other_user_id:
        raise ConflictError("Cannot start a conversation with yourself")

    other_result = await db.execute(select(User).where(User.id == other_user_id, User.is_active.is_(True)))
    other = other_result.scalar_one_or_none()
    if other is None:
        raise NotFoundError("User not found")

    # Look for an existing 1:1 conversation between exactly these two users.
    subq = (
        select(ConversationMember.conversation_id)
        .where(ConversationMember.user_id.in_([user_a.id, other_user_id]))
        .group_by(ConversationMember.conversation_id)
        .having(func.count(ConversationMember.user_id.distinct()) == 2)
    )
    result = await db.execute(
        select(Conversation).where(Conversation.is_group.is_(False), Conversation.id.in_(subq))
    )
    existing = result.scalars().first()
    if existing is not None:
        return existing

    conversation = Conversation(is_group=False, created_by=user_a.id)
    db.add(conversation)
    await db.flush()

    db.add_all(
        [
            ConversationMember(conversation_id=conversation.id, user_id=user_a.id, role=MemberRole.MEMBER),
            ConversationMember(conversation_id=conversation.id, user_id=other_user_id, role=MemberRole.MEMBER),
        ]
    )
    await db.commit()
    await db.refresh(conversation)
    return conversation


async def create_group(
    db: AsyncSession, creator: User, name: str, description: Optional[str], member_ids: List[UUID]
) -> Conversation:
    unique_member_ids = {m for m in member_ids if m != creator.id}
    if not unique_member_ids:
        raise ConflictError("A group needs at least one other member")

    result = await db.execute(select(User.id).where(User.id.in_(unique_member_ids), User.is_active.is_(True)))
    found_ids = {row[0] for row in result.all()}
    missing = unique_member_ids - found_ids
    if missing:
        raise NotFoundError(f"Some users were not found: {missing}")

    conversation = Conversation(is_group=True, name=name, description=description, created_by=creator.id)
    db.add(conversation)
    await db.flush()

    db.add(ConversationMember(conversation_id=conversation.id, user_id=creator.id, role=MemberRole.OWNER))
    db.add_all(
        [
            ConversationMember(conversation_id=conversation.id, user_id=uid, role=MemberRole.MEMBER)
            for uid in unique_member_ids
        ]
    )
    await db.commit()
    await db.refresh(conversation)
    return conversation


async def list_conversations(db: AsyncSession, user_id: UUID, include_archived: bool = False):
    """
    Return this user's conversations with everything the chat list needs:
    the other participant (for DMs), last message preview, and unread count.
    """
    membership_query = select(ConversationMember).where(
        ConversationMember.user_id == user_id, ConversationMember.left_at.is_(None)
    )
    if not include_archived:
        membership_query = membership_query.where(ConversationMember.is_archived.is_(False))

    memberships_result = await db.execute(
        membership_query.options(selectinload(ConversationMember.conversation))
    )
    memberships = memberships_result.scalars().all()

    items = []
    for membership in memberships:
        conversation = membership.conversation

        other_user = None
        if not conversation.is_group:
            other_result = await db.execute(
                select(User)
                .join(ConversationMember, ConversationMember.user_id == User.id)
                .where(
                    ConversationMember.conversation_id == conversation.id,
                    ConversationMember.user_id != user_id,
                )
            )
            other_user = other_result.scalar_one_or_none()

        last_msg_result = await db.execute(
            select(Message)
            .where(Message.conversation_id == conversation.id, Message.is_deleted_for_everyone.is_(False))
            .order_by(Message.created_at.desc())
            .limit(1)
        )
        last_message = last_msg_result.scalar_one_or_none()

        unread_count_query = select(func.count(Message.id)).where(
            Message.conversation_id == conversation.id,
            Message.sender_id != user_id,
        )
        if membership.last_read_at is not None:
            unread_count_query = unread_count_query.where(Message.created_at > membership.last_read_at)
        unread_result = await db.execute(unread_count_query)
        unread_count = unread_result.scalar_one()

        items.append(
            {
                "id": conversation.id,
                "is_group": conversation.is_group,
                "name": conversation.name,
                "group_image_url": conversation.group_image_url,
                "other_user": other_user,
                "last_message_preview": (last_message.content[:100] if last_message and last_message.content else None),
                "last_message_at": conversation.last_message_at,
                "unread_count": unread_count,
                "is_muted": membership.is_muted,
                "is_archived": membership.is_archived,
                "is_pinned": membership.is_pinned,
            }
        )

    # Pinned first, then most recently active.
    items.sort(key=lambda i: (not i["is_pinned"], -(i["last_message_at"] or datetime.min.replace(tzinfo=timezone.utc)).timestamp()))
    return items


async def get_member_user_ids(db: AsyncSession, conversation_id: UUID) -> List[UUID]:
    result = await db.execute(
        select(ConversationMember.user_id).where(
            ConversationMember.conversation_id == conversation_id, ConversationMember.left_at.is_(None)
        )
    )
    return [row[0] for row in result.all()]


async def list_members(db: AsyncSession, conversation_id: UUID, requester_id: UUID) -> List[ConversationMember]:
    """Return all active members of a conversation (requester must be a member)."""
    await require_membership(db, conversation_id, requester_id)
    result = await db.execute(
        select(ConversationMember)
        .where(ConversationMember.conversation_id == conversation_id, ConversationMember.left_at.is_(None))
        .options(selectinload(ConversationMember.user))
        .order_by(ConversationMember.joined_at)
    )
    return result.scalars().all()


async def add_members(db: AsyncSession, conversation_id: UUID, requester_id: UUID, member_ids: List[UUID]) -> None:
    membership = await require_membership(db, conversation_id, requester_id)
    conv = await db.get(Conversation, conversation_id)
    if conv is None or not conv.is_group:
        raise ConflictError("Cannot add members to a direct conversation")
    if membership.role not in (MemberRole.ADMIN, MemberRole.OWNER):
        raise ForbiddenError("Only group admins can add members")

    for uid in member_ids:
        existing = await get_membership(db, conversation_id, uid)
        if existing is None:
            db.add(ConversationMember(conversation_id=conversation_id, user_id=uid, role=MemberRole.MEMBER))
    await db.commit()


async def remove_member(db: AsyncSession, conversation_id: UUID, requester_id: UUID, member_id: UUID) -> None:
    membership = await require_membership(db, conversation_id, requester_id)
    conv = await db.get(Conversation, conversation_id)
    if conv is None or not conv.is_group:
        raise ConflictError("Cannot remove members from a direct conversation")
    if membership.role not in (MemberRole.ADMIN, MemberRole.OWNER) and requester_id != member_id:
        raise ForbiddenError("Only group admins can remove other members")

    target = await get_membership(db, conversation_id, member_id)
    if target is None:
        raise NotFoundError("Member not found in this group")
    target.left_at = datetime.now(timezone.utc)
    await db.commit()


async def update_member_role(db: AsyncSession, conversation_id: UUID, requester_id: UUID, member_id: UUID, role: MemberRole) -> None:
    requester_membership = await require_membership(db, conversation_id, requester_id)
    if requester_membership.role != MemberRole.OWNER:
        raise ForbiddenError("Only the group owner can change member roles")
    target = await get_membership(db, conversation_id, member_id)
    if target is None:
        raise NotFoundError("Member not found in this group")
    target.role = role
    await db.commit()


async def update_group_info(db: AsyncSession, conversation_id: UUID, requester_id: UUID, name: Optional[str], description: Optional[str]) -> Conversation:
    membership = await require_membership(db, conversation_id, requester_id)
    conv = await db.get(Conversation, conversation_id)
    if conv is None or not conv.is_group:
        raise NotFoundError("Group not found")
    if membership.role not in (MemberRole.ADMIN, MemberRole.OWNER):
        raise ForbiddenError("Only group admins can update group info")
    if name is not None:
        conv.name = name
    if description is not None:
        conv.description = description
    await db.commit()
    await db.refresh(conv)
    return conv


async def update_group_avatar(db: AsyncSession, conversation_id: UUID, requester_id: UUID, group_image_url: str) -> Conversation:
    membership = await require_membership(db, conversation_id, requester_id)
    conv = await db.get(Conversation, conversation_id)
    if conv is None or not conv.is_group:
        raise NotFoundError("Group not found")
    if membership.role not in (MemberRole.ADMIN, MemberRole.OWNER):
        raise ForbiddenError("Only group admins can update group picture")
    conv.group_image_url = group_image_url
    await db.commit()
    await db.refresh(conv)
    return conv



async def set_member_flag(db: AsyncSession, conversation_id: UUID, user_id: UUID, *, muted: Optional[bool] = None, archived: Optional[bool] = None, pinned: Optional[bool] = None) -> ConversationMember:
    membership = await require_membership(db, conversation_id, user_id)
    if muted is not None:
        membership.is_muted = muted
    if archived is not None:
        membership.is_archived = archived
    if pinned is not None:
        membership.is_pinned = pinned
    await db.commit()
    await db.refresh(membership)
    return membership


async def mark_read(db: AsyncSession, conversation_id: UUID, user_id: UUID) -> None:
    membership = await require_membership(db, conversation_id, user_id)
    latest_result = await db.execute(
        select(Message.id, Message.created_at)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.desc())
        .limit(1)
    )
    row = latest_result.first()
    if row is not None:
        membership.last_read_message_id = row[0]
        membership.last_read_at = datetime.now(timezone.utc)
        await db.commit()
