from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import MessageStatusEnum, MessageType
from app.schemas.user import UserPublic


class SendMessageRequest(BaseModel):
    content: Optional[str] = Field(default=None, max_length=10000)
    message_type: MessageType = MessageType.TEXT
    reply_to_id: Optional[UUID] = None
    attachment_ids: List[UUID] = Field(default_factory=list)  # pre-uploaded attachment IDs to link


class EditMessageRequest(BaseModel):
    content: str = Field(min_length=1, max_length=10000)


class ReactRequest(BaseModel):
    emoji: str = Field(min_length=1, max_length=16)


class ForwardMessageRequest(BaseModel):
    conversation_ids: List[UUID] = Field(min_length=1)


class AttachmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    file_name: str
    file_url: str
    mime_type: str
    file_size_bytes: int
    width: Optional[int] = None
    height: Optional[int] = None
    duration_seconds: Optional[int] = None
    thumbnail_url: Optional[str] = None


class ReactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: UUID
    emoji: str


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    conversation_id: UUID
    sender_id: UUID
    sender: Optional[UserPublic] = None
    message_type: MessageType
    content: Optional[str] = None
    reply_to_id: Optional[UUID] = None
    is_edited: bool
    is_deleted_for_everyone: bool
    is_pinned: bool
    created_at: datetime
    updated_at: datetime
    attachments: List[AttachmentOut] = Field(default_factory=list)
    reactions: List[ReactionOut] = Field(default_factory=list)
    status: Optional[MessageStatusEnum] = None  # status for the requesting user's perspective (sent view only)


class MessagePage(BaseModel):
    items: List[MessageOut]
    has_more: bool
    next_cursor: Optional[str] = None  # created_at ISO string of the oldest item returned
