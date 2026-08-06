from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database.session import get_db
from app.middleware.error_handlers import ValidationAppError
from app.models.attachment import Attachment
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.message import (
    AttachmentOut,
    EditMessageRequest,
    ForwardMessageRequest,
    MessageOut,
    MessagePage,
    ReactRequest,
    SendMessageRequest,
)
from app.services import message_service, storage_service

router = APIRouter(tags=["Messages"])


@router.post("/conversations/{conversation_id}/messages", response_model=MessageOut, status_code=201)
async def send_message(
    conversation_id: UUID,
    payload: SendMessageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send a text message (or a message referencing already-uploaded attachment ids)."""
    message = await message_service.send_message(
        db, conversation_id, current_user,
        content=payload.content,
        message_type=payload.message_type,
        reply_to_id=payload.reply_to_id,
        attachment_ids=payload.attachment_ids,
        client_message_id=payload.client_message_id,
    )
    return message


@router.post("/conversations/{conversation_id}/messages/with-attachment", response_model=MessageOut, status_code=201)
async def send_message_with_attachment(
    conversation_id: UUID,
    file: UploadFile = File(...),
    content: Optional[str] = None,
    client_message_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload a file and send it as a message in one call — covers image,
    video, audio (including voice notes recorded client-side), and
    document attachments.
    """
    from app.models.enums import MessageType
    from app.services import conversation_service

    await conversation_service.require_membership(db, conversation_id, current_user.id)

    allowed_map = {
        **{t: MessageType.IMAGE for t in storage_service.ALLOWED_IMAGE_TYPES},
        **{t: MessageType.VIDEO for t in storage_service.ALLOWED_VIDEO_TYPES},
        **{t: MessageType.AUDIO for t in storage_service.ALLOWED_AUDIO_TYPES},
        **{t: MessageType.DOCUMENT for t in storage_service.ALLOWED_DOCUMENT_TYPES},
    }
    if file.content_type not in allowed_map:
        raise ValidationAppError("Unsupported file type")

    public_url, storage_path, size, mime_type = await storage_service.save_upload(file, category="attachments")

    message = await message_service.send_message(
        db, conversation_id, current_user,
        content=content,
        message_type=allowed_map[file.content_type],
        reply_to_id=None,
        attachment_ids=[],
        client_message_id=client_message_id,
    )
    attachment = Attachment(
        message_id=message.id,
        file_name=file.filename or "file",
        file_url=public_url,
        storage_path=storage_path,
        mime_type=mime_type,
        file_size_bytes=size,
    )
    db.add(attachment)
    await db.commit()
    await db.refresh(message)
    return message


@router.get("/conversations/{conversation_id}/messages", response_model=MessagePage)
async def list_messages(
    conversation_id: UUID,
    before: Optional[datetime] = Query(default=None, description="Return messages older than this timestamp"),
    limit: int = Query(default=30, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Paginated message history, oldest-first within the page, for infinite-scroll-up loading."""
    messages, has_more = await message_service.get_messages(db, conversation_id, current_user.id, before, limit)
    next_cursor = messages[0].created_at.isoformat() if messages and has_more else None
    return MessagePage(items=messages, has_more=has_more, next_cursor=next_cursor)


@router.patch("/messages/{message_id}", response_model=MessageOut)
async def edit_message(
    message_id: UUID,
    payload: EditMessageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await message_service.edit_message(db, message_id, current_user.id, payload.content)


@router.delete("/messages/{message_id}/for-me", response_model=MessageResponse)
async def delete_message_for_me(
    message_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await message_service.delete_for_me(db, message_id, current_user.id)
    return MessageResponse(message="Message deleted for you")


@router.delete("/messages/{message_id}/for-everyone", response_model=MessageResponse)
async def delete_message_for_everyone(
    message_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await message_service.delete_for_everyone(db, message_id, current_user.id)
    return MessageResponse(message="Message deleted for everyone")


@router.post("/messages/{message_id}/react", response_model=MessageOut)
async def react_to_message(
    message_id: UUID,
    payload: ReactRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await message_service.react_to_message(db, message_id, current_user.id, payload.emoji)


@router.post("/messages/{message_id}/pin", response_model=MessageOut)
async def pin_message(
    message_id: UUID,
    pinned: bool = Query(default=True),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await message_service.set_pinned(db, message_id, current_user.id, pinned)


@router.post("/messages/{message_id}/forward", response_model=List[MessageOut])
async def forward_message(
    message_id: UUID,
    payload: ForwardMessageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await message_service.forward_message(db, message_id, current_user.id, payload.conversation_ids)


@router.post("/messages/{message_id}/delivered", response_model=MessageResponse)
async def mark_delivered(
    message_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await message_service.mark_delivered(db, message_id, current_user.id)
    return MessageResponse(message="Marked delivered")
