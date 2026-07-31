"""Shared Python enums mapped to Postgres enum/varchar columns."""
import enum


class MemberRole(str, enum.Enum):
    MEMBER = "member"
    ADMIN = "admin"
    OWNER = "owner"


class MessageType(str, enum.Enum):
    TEXT = "text"
    IMAGE = "image"
    VIDEO = "video"
    AUDIO = "audio"
    DOCUMENT = "document"
    VOICE = "voice"
    SYSTEM = "system"  # e.g. "X added Y to the group"


class MessageStatusEnum(str, enum.Enum):
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"


class NotificationType(str, enum.Enum):
    NEW_MESSAGE = "new_message"
    MENTION = "mention"
    GROUP_ADDED = "group_added"
    GROUP_REMOVED = "group_removed"
    REACTION = "reaction"
    FRIEND_REQUEST = "friend_request"


class CallStatus(str, enum.Enum):
    RINGING = "ringing"       # invite sent, not yet answered
    ONGOING = "ongoing"       # accepted, in progress
    COMPLETED = "completed"   # answered, then ended normally
    MISSED = "missed"         # never answered, caller gave up / callee didn't respond
    REJECTED = "rejected"     # callee explicitly declined
    CANCELLED = "cancelled"   # caller hung up before it was answered
