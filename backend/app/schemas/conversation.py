from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import MemberRole
from app.schemas.user import UserPublic


class CreateDirectConversationRequest(BaseModel):
    user_id: UUID  # the other participant


class CreateGroupRequest(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    description: Optional[str] = Field(default=None, max_length=1000)
    member_ids: List[UUID] = Field(min_length=1, description="Initial members besides yourself")


class UpdateGroupRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=150)
    description: Optional[str] = Field(default=None, max_length=1000)


class ConversationMemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user: UserPublic
    role: MemberRole
    is_muted: bool
    is_archived: bool
    is_pinned: bool
    joined_at: datetime


class ConversationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    is_group: bool
    name: Optional[str] = None
    description: Optional[str] = None
    group_image_url: Optional[str] = None
    last_message_at: Optional[datetime] = None
    created_at: datetime


class ConversationListItem(BaseModel):
    """Chat-list row: conversation + the other party (for DMs) + unread count + last message preview."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    is_group: bool
    name: Optional[str] = None
    group_image_url: Optional[str] = None
    other_user: Optional[UserPublic] = None  # populated for 1:1 chats
    last_message_preview: Optional[str] = None
    last_message_at: Optional[datetime] = None
    unread_count: int = 0
    is_muted: bool = False
    is_archived: bool = False
    is_pinned: bool = False


class AddMembersRequest(BaseModel):
    member_ids: List[UUID] = Field(min_length=1)


class UpdateMemberRoleRequest(BaseModel):
    role: MemberRole
