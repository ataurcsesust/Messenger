"""
Seed the database with sample accounts and conversations for demo/testing.

Usage:
    python -m app.scripts.seed_data

Creates 4 users (password for all: Password123):
    alice / alice@example.com
    bob   / bob@example.com
    carol / carol@example.com
    dave  / dave@example.com

Plus a DM between alice/bob (with a few messages) and a group
"Weekend Trip" containing alice, bob, and carol.

Safe to re-run — skips any user that already exists.
"""
import asyncio
from datetime import datetime, timezone

from sqlalchemy import select

from app.auth.security import hash_password
from app.database.session import AsyncSessionLocal
from app.models.conversation import Conversation, ConversationMember
from app.models.enums import MemberRole, MessageType
from app.models.message import Message
from app.models.user import User

SEED_PASSWORD = "Password123"

SAMPLE_USERS = [
    {"email": "alice@example.com", "username": "alice", "full_name": "Alice Smith"},
    {"email": "bob@example.com", "username": "bob", "full_name": "Bob Jones"},
    {"email": "carol@example.com", "username": "carol", "full_name": "Carol Nguyen"},
    {"email": "dave@example.com", "username": "dave", "full_name": "Dave Patel"},
]


async def get_or_create_user(db, data: dict) -> User:
    result = await db.execute(select(User).where(User.username == data["username"]))
    user = result.scalar_one_or_none()
    if user:
        return user
    user = User(
        email=data["email"],
        username=data["username"],
        full_name=data["full_name"],
        password_hash=hash_password(SEED_PASSWORD),
        is_verified=True,
    )
    db.add(user)
    await db.flush()
    return user


async def main():
    async with AsyncSessionLocal() as db:
        users = {}
        for data in SAMPLE_USERS:
            users[data["username"]] = await get_or_create_user(db, data)
        await db.commit()
        print(f"Seeded users: {', '.join(users.keys())} (password: {SEED_PASSWORD})")

        alice, bob, carol = users["alice"], users["bob"], users["carol"]

        # DM between alice and bob, if it doesn't already exist.
        existing = await db.execute(
            select(Conversation).where(Conversation.is_group.is_(False))
        )
        dm = next((c for c in existing.scalars().all()), None)
        if dm is None:
            dm = Conversation(is_group=False, created_by=alice.id)
            db.add(dm)
            await db.flush()
            db.add_all([
                ConversationMember(conversation_id=dm.id, user_id=alice.id, role=MemberRole.MEMBER),
                ConversationMember(conversation_id=dm.id, user_id=bob.id, role=MemberRole.MEMBER),
            ])
            db.add_all([
                Message(conversation_id=dm.id, sender_id=alice.id, message_type=MessageType.TEXT, content="Hey Bob! Welcome to the app 👋"),
                Message(conversation_id=dm.id, sender_id=bob.id, message_type=MessageType.TEXT, content="Thanks Alice! This looks great."),
            ])
            dm.last_message_at = datetime.now(timezone.utc)
            print("Seeded DM: alice <-> bob")

        # Group chat with alice, bob, carol.
        existing_group = await db.execute(select(Conversation).where(Conversation.is_group.is_(True)))
        group = existing_group.scalar_one_or_none()
        if group is None:
            group = Conversation(is_group=True, name="Weekend Trip", description="Planning our weekend getaway", created_by=alice.id)
            db.add(group)
            await db.flush()
            db.add_all([
                ConversationMember(conversation_id=group.id, user_id=alice.id, role=MemberRole.OWNER),
                ConversationMember(conversation_id=group.id, user_id=bob.id, role=MemberRole.MEMBER),
                ConversationMember(conversation_id=group.id, user_id=carol.id, role=MemberRole.MEMBER),
            ])
            db.add(Message(conversation_id=group.id, sender_id=alice.id, message_type=MessageType.TEXT, content="Who's in for the weekend trip?"))
            group.last_message_at = datetime.now(timezone.utc)
            print("Seeded group: Weekend Trip (alice, bob, carol)")

        await db.commit()
        print("Seed complete.")


if __name__ == "__main__":
    asyncio.run(main())
