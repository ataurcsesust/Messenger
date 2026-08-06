import asyncio
import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.database.session import Base, get_db
from app.models.user import User
from app.models.conversation import Conversation, ConversationMember
from app.models.message import Message
from app.models.call import Call
from app.models.enums import MessageType, CallStatus, MemberRole
from app.auth.security import create_access_token

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestingSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def override_get_db():
    async with TestingSessionLocal() as session:
        yield session

app.dependency_overrides[get_db] = override_get_db

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def clean_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

def test_health_endpoint():
    async def run():
        await init_db()
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                res = await client.get("/health")
                assert res.status_code == 200
                assert res.json() == {"status": "healthy"}
        finally:
            await clean_db()
    asyncio.run(run())

def test_message_idempotency():
    async def run():
        await init_db()
        try:
            async with TestingSessionLocal() as db:
                user1 = User(id=uuid.uuid4(), email="user1@example.com", username="user1", full_name="User One", password_hash="pw")
                user2 = User(id=uuid.uuid4(), email="user2@example.com", username="user2", full_name="User Two", password_hash="pw")
                db.add_all([user1, user2])
                await db.flush()

                conv = Conversation(is_group=False, created_by=user1.id)
                db.add(conv)
                await db.flush()
                db.add_all([
                    ConversationMember(conversation_id=conv.id, user_id=user1.id, role=MemberRole.MEMBER),
                    ConversationMember(conversation_id=conv.id, user_id=user2.id, role=MemberRole.MEMBER),
                ])
                await db.commit()

                token = create_access_token(user1.id)
                headers = {"Authorization": f"Bearer {token}"}

                async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                    client_msg_id = f"client-test-{uuid.uuid4()}"
                    payload = {
                        "content": "Hello Render Free Tier",
                        "message_type": "text",
                        "client_message_id": client_msg_id
                    }

                    # First post
                    res1 = await client.post(f"/api/v1/conversations/{conv.id}/messages", json=payload, headers=headers)
                    assert res1.status_code == 201
                    data1 = res1.json()
                    assert data1["content"] == "Hello Render Free Tier"
                    assert data1["client_message_id"] == client_msg_id

                    # Retry post with same client_message_id
                    res2 = await client.post(f"/api/v1/conversations/{conv.id}/messages", json=payload, headers=headers)
                    assert res2.status_code == 201
                    data2 = res2.json()

                    # Must return identical message ID (idempotent)
                    assert data1["id"] == data2["id"]
        finally:
            await clean_db()
    asyncio.run(run())

def test_call_retry_idempotency():
    async def run():
        await init_db()
        try:
            async with TestingSessionLocal() as db:
                user1 = User(id=uuid.uuid4(), email="caller@example.com", username="caller", full_name="Caller", password_hash="pw", is_online=True)
                user2 = User(id=uuid.uuid4(), email="callee@example.com", username="callee", full_name="Callee", password_hash="pw", is_online=True)
                db.add_all([user1, user2])
                await db.commit()

                from app.websocket.manager import manager
                original_is_online = manager.is_online
                manager.is_online = lambda uid: True

                try:
                    token = create_access_token(user1.id)
                    headers = {"Authorization": f"Bearer {token}"}

                    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                        # First initiate call
                        res1 = await client.post("/api/v1/calls", json={"callee_id": str(user2.id)}, headers=headers)
                        assert res1.status_code == 201
                        call1 = res1.json()

                        # Retry initiate call (simulating network timeout retry)
                        res2 = await client.post("/api/v1/calls", json={"callee_id": str(user2.id)}, headers=headers)
                        assert res2.status_code == 201
                        call2 = res2.json()

                        # Should return the same call ID idempotently instead of 409 error
                        assert call1["id"] == call2["id"]
                finally:
                    manager.is_online = original_is_online
        finally:
            await clean_db()
    asyncio.run(run())
