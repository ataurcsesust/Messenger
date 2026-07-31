from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.middleware.error_handlers import ForbiddenError, NotFoundError, ValidationAppError
from app.models.attachment import Attachment
from app.models.conversation import Conversation, ConversationMember
from app.models.enums import MessageStatusEnum, MessageType, NotificationType
from app.models.message import Message, MessageDeletion, MessageReaction, MessageStatus
from app.models.notification import Notification
from app.models.user import BlockedUser, User
from app.services import conversation_service
from app.websocket.manager import manager

MESSAGE_LOAD_OPTIONS = (
    selectinload(Message.sender),
    selectinload(Message.attachments),
    selectinload(Message.reactions),
)


async def _load_message(db: AsyncSession, message_id: UUID) -> Optional[Message]:
    result = await db.execute(
        select(Message).where(Message.id == message_id).options(*MESSAGE_LOAD_OPTIONS)
    )
    return result.scalar_one_or_none()


async def send_message(
    db: AsyncSession,
    conversation_id: UUID,
    sender: User,
    content: Optional[str],
    message_type: MessageType,
    reply_to_id: Optional[UUID],
    attachment_ids: List[UUID],
) -> Message:
    await conversation_service.require_membership(db, conversation_id, sender.id)

    if message_type == MessageType.TEXT and not content:
        raise ValidationAppError("Text messages require content")

    conversation = await db.get(Conversation, conversation_id)

    # In a direct (1:1) conversation, block either direction from sending.
    if not conversation.is_group:
        other_ids = [
            uid for uid in await conversation_service.get_member_user_ids(db, conversation_id) if uid != sender.id
        ]
        if other_ids:
            other_id = other_ids[0]
            blocked_result = await db.execute(
                select(BlockedUser).where(
                    or_(
                        and_(BlockedUser.blocker_id == other_id, BlockedUser.blocked_id == sender.id),
                        and_(BlockedUser.blocker_id == sender.id, BlockedUser.blocked_id == other_id),
                    )
                )
            )
            if blocked_result.scalar_one_or_none() is not None:
                raise ForbiddenError("You can't message this user.")

    message = Message(
        conversation_id=conversation_id,
        sender_id=sender.id,
        message_type=message_type,
        content=content,
        reply_to_id=reply_to_id,
    )
    db.add(message)
    await db.flush()

    if attachment_ids:
        result = await db.execute(select(Attachment).where(Attachment.id.in_(attachment_ids)))
        attachments = result.scalars().all()
        for att in attachments:
            att.message_id = message.id

    # Create a status row (SENT) for every other member — powers per-recipient
    # delivered/read tracking, including in group chats.
    member_ids = await conversation_service.get_member_user_ids(db, conversation_id)
    for uid in member_ids:
        if uid != sender.id:
            db.add(MessageStatus(message_id=message.id, user_id=uid, status=MessageStatusEnum.SENT))

    conversation.last_message_at = datetime.now(timezone.utc)

    # Create an in-app notification for each recipient who hasn't muted this chat.
    memberships_result = await db.execute(
        select(ConversationMember).where(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id != sender.id,
            ConversationMember.is_muted.is_(False),
        )
    )
    preview = (content or f"Sent a {message_type.value}")[:200]
    for membership in memberships_result.scalars().all():
        db.add(
            Notification(
                user_id=membership.user_id,
                actor_id=sender.id,
                type=NotificationType.NEW_MESSAGE,
                title=sender.full_name,
                body=preview,
                reference_id=conversation_id,
            )
        )

    await db.commit()
    message = await _load_message(db, message.id)

    event = {
        "type": "new_message",
        "conversation_id": str(conversation_id),
        "message": _serialize_message(message),
    }
    await manager.send_to_users(member_ids, event)
    notify_ids = [uid for uid in member_ids if uid != sender.id]
    await manager.send_to_users(
        notify_ids,
        {"type": "notification", "notification_type": "new_message", "conversation_id": str(conversation_id), "title": sender.full_name, "body": preview},
    )

    return message


def _serialize_message(message: Message) -> dict:
    return {
        "id": str(message.id),
        "conversation_id": str(message.conversation_id),
        "sender_id": str(message.sender_id),
        "message_type": message.message_type.value,
        "content": message.content if not message.is_deleted_for_everyone else None,
        "reply_to_id": str(message.reply_to_id) if message.reply_to_id else None,
        "is_edited": message.is_edited,
        "is_deleted_for_everyone": message.is_deleted_for_everyone,
        "is_pinned": message.is_pinned,
        "created_at": message.created_at.isoformat(),
        "updated_at": message.updated_at.isoformat(),
        "attachments": [
            {
                "id": str(a.id),
                "file_name": a.file_name,
                "file_url": a.file_url,
                "mime_type": a.mime_type,
                "file_size_bytes": a.file_size_bytes,
            }
            for a in message.attachments
        ],
        "reactions": [{"user_id": str(r.user_id), "emoji": r.emoji} for r in message.reactions],
    }


async def get_messages(
    db: AsyncSession, conversation_id: UUID, user_id: UUID, before: Optional[datetime], limit: int
):
    await conversation_service.require_membership(db, conversation_id, user_id)

    hidden_ids_result = await db.execute(
        select(MessageDeletion.message_id).where(MessageDeletion.user_id == user_id)
    )
    hidden_ids = {row[0] for row in hidden_ids_result.all()}

    query = select(Message).where(Message.conversation_id == conversation_id).options(*MESSAGE_LOAD_OPTIONS)
    if before is not None:
        query = query.where(Message.created_at < before)
    query = query.order_by(Message.created_at.desc()).limit(limit + 1)

    result = await db.execute(query)
    messages = [m for m in result.scalars().all() if m.id not in hidden_ids]

    has_more = len(messages) > limit
    messages = messages[:limit]
    messages.reverse()  # return oldest-first for easy rendering
    return messages, has_more


async def edit_message(db: AsyncSession, message_id: UUID, user_id: UUID, new_content: str) -> Message:
    message = await _load_message(db, message_id)
    if message is None:
        raise NotFoundError("Message not found")
    if message.sender_id != user_id:
        raise ForbiddenError("You can only edit your own messages")
    if message.is_deleted_for_everyone:
        raise ValidationAppError("Cannot edit a deleted message")

    message.content = new_content
    message.is_edited = True
    await db.commit()
    message = await _load_message(db, message_id)

    member_ids = await conversation_service.get_member_user_ids(db, message.conversation_id)
    await manager.send_to_users(
        member_ids, {"type": "message_edited", "conversation_id": str(message.conversation_id), "message": _serialize_message(message)}
    )
    return message


async def delete_for_me(db: AsyncSession, message_id: UUID, user_id: UUID) -> None:
    message = await db.get(Message, message_id)
    if message is None:
        raise NotFoundError("Message not found")
    await conversation_service.require_membership(db, message.conversation_id, user_id)

    existing = await db.execute(
        select(MessageDeletion).where(MessageDeletion.message_id == message_id, MessageDeletion.user_id == user_id)
    )
    if existing.scalar_one_or_none() is None:
        db.add(MessageDeletion(message_id=message_id, user_id=user_id))
        await db.commit()


async def delete_for_everyone(db: AsyncSession, message_id: UUID, user_id: UUID) -> None:
    message = await _load_message(db, message_id)
    if message is None:
        raise NotFoundError("Message not found")
    if message.sender_id != user_id:
        raise ForbiddenError("You can only delete your own messages for everyone")

    message.is_deleted_for_everyone = True
    message.content = None
    await db.commit()

    member_ids = await conversation_service.get_member_user_ids(db, message.conversation_id)
    await manager.send_to_users(
        member_ids,
        {"type": "message_deleted", "conversation_id": str(message.conversation_id), "message_id": str(message_id)},
    )


async def react_to_message(db: AsyncSession, message_id: UUID, user_id: UUID, emoji: str) -> Message:
    message = await db.get(Message, message_id)
    if message is None:
        raise NotFoundError("Message not found")
    await conversation_service.require_membership(db, message.conversation_id, user_id)

    existing = await db.execute(
        select(MessageReaction).where(MessageReaction.message_id == message_id, MessageReaction.user_id == user_id)
    )
    reaction = existing.scalar_one_or_none()
    if reaction is not None:
        reaction.emoji = emoji
    else:
        db.add(MessageReaction(message_id=message_id, user_id=user_id, emoji=emoji))
    await db.commit()

    message = await _load_message(db, message_id)
    member_ids = await conversation_service.get_member_user_ids(db, message.conversation_id)
    await manager.send_to_users(
        member_ids,
        {"type": "message_reaction", "conversation_id": str(message.conversation_id), "message": _serialize_message(message)},
    )
    return message


async def set_pinned(db: AsyncSession, message_id: UUID, user_id: UUID, pinned: bool) -> Message:
    message = await _load_message(db, message_id)
    if message is None:
        raise NotFoundError("Message not found")
    await conversation_service.require_membership(db, message.conversation_id, user_id)

    message.is_pinned = pinned
    message.pinned_at = datetime.now(timezone.utc) if pinned else None
    await db.commit()
    message = await _load_message(db, message_id)

    member_ids = await conversation_service.get_member_user_ids(db, message.conversation_id)
    await manager.send_to_users(
        member_ids,
        {"type": "message_pinned", "conversation_id": str(message.conversation_id), "message": _serialize_message(message)},
    )
    return message


async def forward_message(db: AsyncSession, message_id: UUID, user_id: UUID, target_conversation_ids: List[UUID]) -> List[Message]:
    original = await _load_message(db, message_id)
    if original is None:
        raise NotFoundError("Message not found")
    await conversation_service.require_membership(db, original.conversation_id, user_id)

    forwarded = []
    for conv_id in target_conversation_ids:
        user = await db.get(User, user_id)
        msg = await send_message(
            db, conv_id, user,
            content=original.content,
            message_type=original.message_type,
            reply_to_id=None,
            attachment_ids=[],
        )
        forwarded.append(msg)
    return forwarded


async def mark_delivered(db: AsyncSession, message_id: UUID, user_id: UUID) -> None:
    result = await db.execute(
        select(MessageStatus).where(MessageStatus.message_id == message_id, MessageStatus.user_id == user_id)
    )
    status_row = result.scalar_one_or_none()
    if status_row is not None and status_row.status == MessageStatusEnum.SENT:
        status_row.status = MessageStatusEnum.DELIVERED
        await db.commit()


async def mark_conversation_read(db: AsyncSession, conversation_id: UUID, user_id: UUID) -> None:
    await conversation_service.mark_read(db, conversation_id, user_id)

    result = await db.execute(
        select(MessageStatus)
        .join(Message, Message.id == MessageStatus.message_id)
        .where(
            Message.conversation_id == conversation_id,
            MessageStatus.user_id == user_id,
            MessageStatus.status != MessageStatusEnum.READ,
        )
    )
    rows = result.scalars().all()
    message_ids = []
    for row in rows:
        row.status = MessageStatusEnum.READ
        message_ids.append(str(row.message_id))
    if rows:
        await db.commit()
        member_ids = await conversation_service.get_member_user_ids(db, conversation_id)
        await manager.send_to_users(
            member_ids,
            {
                "type": "messages_read",
                "conversation_id": str(conversation_id),
                "reader_id": str(user_id),
                "message_ids": message_ids,
            },
        )
