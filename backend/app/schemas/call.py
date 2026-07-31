from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.enums import CallStatus
from app.schemas.user import UserPublic


class InitiateCallRequest(BaseModel):
    callee_id: UUID


class CallOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    conversation_id: UUID
    caller_id: UUID
    callee_id: UUID
    status: CallStatus
    started_at: datetime
    answered_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    duration_seconds: Optional[int] = None


class CallHistoryItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    status: CallStatus
    started_at: datetime
    ended_at: Optional[datetime] = None
    duration_seconds: Optional[int] = None
    is_outgoing: bool  # true if the requesting user was the caller
    other_user: UserPublic
