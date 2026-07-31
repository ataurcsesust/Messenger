"""
Import every model here so a single `from app.models import *` (used by
Alembic's env.py and by the app on startup) registers all tables on
Base.metadata. Do not remove imports even if they look unused.
"""
from app.models.user import User, BlockedUser, UserReport  # noqa: F401
from app.models.refresh_token import RefreshToken  # noqa: F401
from app.models.conversation import Conversation, ConversationMember  # noqa: F401
from app.models.message import (  # noqa: F401
    Message,
    MessageDeletion,
    MessageReaction,
    MessageStatus,
)
from app.models.attachment import Attachment  # noqa: F401
from app.models.notification import Notification  # noqa: F401
from app.models.call import Call  # noqa: F401

__all__ = [
    "User",
    "BlockedUser",
    "UserReport",
    "RefreshToken",
    "Conversation",
    "ConversationMember",
    "Message",
    "MessageDeletion",
    "MessageReaction",
    "MessageStatus",
    "Attachment",
    "Notification",
    "Call",
]
