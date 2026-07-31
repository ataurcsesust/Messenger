from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class UserPublic(BaseModel):
    """Safe, public-facing view of a user — never includes password_hash."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    username: str
    full_name: str
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    is_online: bool
    last_seen: Optional[datetime] = None


class UserMe(UserPublic):
    """Extended view returned only to the authenticated user themself."""
    email: str
    is_verified: bool
    show_last_seen: bool
    show_read_receipts: bool
    created_at: datetime


class UserUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    bio: Optional[str] = None
    show_last_seen: Optional[bool] = None
    show_read_receipts: Optional[bool] = None


class UserSearchResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    username: str
    full_name: str
    avatar_url: Optional[str] = None
    is_online: bool

