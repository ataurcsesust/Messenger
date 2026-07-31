# Messenger Clone — Backend

A FastAPI + PostgreSQL backend for a Messenger-style real-time chat app.

## Stack
- FastAPI (async) + Uvicorn
- PostgreSQL + SQLAlchemy 2.0 (async, via asyncpg) + Alembic migrations
- JWT access tokens (short-lived) + rotating opaque refresh tokens (hashed at rest)
- bcrypt password hashing (via passlib)
- WebSocket for real-time delivery (native FastAPI/Starlette, in-process connection manager)
- slowapi for rate limiting
- Local filesystem storage for uploads (swappable for S3 — see `app/services/storage_service.py`)

## Setup

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# Edit .env: set DATABASE_URL, ASYNC_DATABASE_URL, and a strong JWT_SECRET_KEY
#   (generate one with: openssl rand -hex 32)

createdb messenger_db   # or via psql: CREATE DATABASE messenger_db;
alembic upgrade head
python -m app.scripts.seed_data   # optional: creates demo accounts (see below)

uvicorn app.main:app --reload
```

API docs: http://localhost:8000/docs (Swagger) or /redoc.
WebSocket: `ws://localhost:8000/ws?token=<access_token>`.

## Seed data

```bash
python -m app.scripts.seed_data
```

Creates 4 accounts — `alice`, `bob`, `carol`, `dave` — all with password
`Password123`, plus a DM between alice/bob and a "Weekend Trip" group
with alice (owner), bob, and carol. Safe to re-run.

## What's implemented

**Database models**: Users, Conversations, ConversationMembers, Messages,
Attachments, Notifications, RefreshTokens, MessageReaction, MessageStatus
(per-recipient delivered/read — supports group chats), MessageDeletion
(delete-for-me), BlockedUser, UserReport. 12 tables total, all migrated.

**Auth** (`/api/v1/auth`): register, login (rate-limited), refresh (with
rotation), logout, logout-all-devices, get current user, change password
(invalidates all sessions).

**Users** (`/api/v1/users`): update profile, avatar upload, search, get
public profile (respects last-seen privacy setting), block/unblock
(enforced — see below), report.

**Conversations** (`/api/v1/conversations`): list (chat list — with
unread counts, last message preview, sorted pinned-first), create direct
(reuses existing DM instead of duplicating), create group, update group
info, list members, add/remove members, change member role (owner-only),
mute/archive/pin, mark read.

**Messages** (`/api/v1/messages`, plus `/conversations/{id}/messages`):
send (text or with an uploaded attachment in one call — covers image,
video, audio/voice, document), paginated history (infinite-scroll-up via
`before` cursor), edit, delete-for-me, delete-for-everyone, react, pin,
forward, mark-delivered. Sending to/from a user you've blocked (or who
has blocked you) in a direct conversation is rejected with 403; group
messages are unaffected by DM blocks.

**Notifications** (`/api/v1/notifications`): list, unread count, mark one/
all read. Created automatically when a message is sent to a non-muted
conversation member.

**Calls** (`/api/v1/calls`): 1:1 WebRTC voice calling. `POST /calls`
initiates (creates a DB record + pushes `incoming_call` over WebSocket;
rejects with 409 if the callee is offline or either party is already on
a call, 403 if either has blocked the other), `/accept`, `/reject`,
`/end`, plus `GET /calls` for call history and `GET /calls/{id}` to
recover call state after a page reload mid-call. The WebSocket also
relays raw WebRTC signaling (`call_offer`/`call_answer`/
`call_ice_candidate`) between the two peers — the server never inspects
or stores SDP/ICE payloads, only the call's lifecycle/outcome. If a
participant's WebSocket disconnects mid-call (crash, network loss), the
server auto-ends the call and notifies the other party.

**WebSocket** (`/ws?token=...`): presence (online/last-seen, broadcast only
to users who share a conversation with you — not global), typing/
stop-typing relay, and live push for every message event (new/edited/
deleted/reaction/pinned/read-receipt/notification).

## Security choices worth knowing about
- Refresh tokens are opaque random strings; only their SHA-256 hash is
  stored, so a DB leak alone can't be replayed as a login.
- Refresh tokens rotate on every use — reusing an old one fails.
- Password changes revoke all existing sessions.
- Login timing is constant whether or not the account exists.
- Blocking is enforced at the point messages are sent, not just recorded.

## Verified

Tested end-to-end against a real running PostgreSQL instance and a real
running Uvicorn server (not just unit-tested in isolation):
- **Auth flow**: register → duplicate rejection → login → wrong-password
  rejection → `/me` → refresh rotation → old-token rejection → logout →
  change-password → old/new password behavior.
- **Messaging flow**: search users → create DM → send → chat list unread
  count → paginated fetch → react → edit → mark-read → notification
  unread-count → create group → delete-for-everyone → confirm hidden for
  recipient.
- **Group management flow**: create group → list members → add member →
  promote to admin → admin removes a member → removed member correctly
  loses access (404) → update group name.
- **Block enforcement flow**: DM works normally → user B blocks user A →
  both A→B and B→A sends correctly rejected with 403 (bidirectional) →
  group messages unaffected by a DM block → unblock → sending works
  again.
- **Voice calling flow** (real concurrent WebSocket connections, not
  mocked): call an offline user → 409 → both users connect → initiate
  call → callee receives `incoming_call` → a third user calling the busy
  callee → 409 → WebRTC offer/answer/ICE relayed correctly → accept →
  duration computed correctly on end → call history correct for both
  parties → reject flow (separately verified with explicit event-type
  filtering to rule out test-harness ambiguity) → **mid-call disconnect**
  (force-closed one socket) correctly auto-ends the call and notifies
  the other party, with the DB record showing `completed` status and a
  correct duration.
- **Full browser-level test of the calling feature** using Playwright +
  real Chromium with fake media devices (`--use-fake-device-for-media-
  stream`), two separate browser contexts as two real logged-in users:
  clicked the call button, confirmed the incoming-call UI rendered
  correctly for the other party (screenshotted), accepted, confirmed the
  live duration timer ticked ("0:05" observed), toggled mute, ended the
  call from the other side, confirmed the "Call ended" UI appeared and
  auto-cleared, and confirmed the resulting DB record was accurate
  (`status=completed`, `duration_seconds=5`). This caught and fixed a
  real bug — see below.
- **Live WebSocket test** with two real concurrent connections: typing
  indicator relayed instantly, new message broadcast instantly after a
  REST send, and live notification push — all confirmed arriving over
  the socket in real time, not via polling.
- `python -m app.scripts.seed_data` runs cleanly against a real database.

## Docker

See the root `README.md` and `docker-compose.yml` one directory up.
This backend's `Dockerfile` runs `alembic upgrade head` then starts
Uvicorn. Note: the Dockerfile/compose setup follows standard patterns
and the compose YAML has been validated, but `docker compose up` itself
wasn't run in the sandbox this was built in (no Docker available there);
the app underneath has been verified running directly (above).

## Known simplifications
- The WebSocket connection manager is in-process memory. Fine for a
  single-server deployment; scaling to multiple app processes needs a
  Redis pub/sub layer behind it (noted in `app/websocket/manager.py`).
- No E2E encryption — messages are stored in plaintext in Postgres, as is
  standard for a Messenger-style app (not a Signal-style app).
- Report records are stored but there's no admin/moderation panel to act
  on them yet (block records ARE actively enforced, unlike reports).
- **Calling**: audio only (no video), 1:1 only (no group calls), no
  call-waiting/hold, and only public STUN servers are configured (no
  TURN server) — calls between peers on restrictive NATs (e.g. behind
  symmetric NAT/corporate firewalls) may fail to establish a direct
  media path in that case, since there's no TURN relay fallback. Adding
  a TURN server (e.g. coturn, or a managed service) is the standard fix
  if you hit that in practice.

## Project structure

```
app/
  routers/      auth, users, conversations, messages, notifications
  models/       SQLAlchemy models + enums
  schemas/      Pydantic request/response schemas
  services/     business logic (auth, conversation, message, storage)
  websocket/    connection manager + /ws route
  auth/         password hashing, JWT, current-user dependency
  middleware/   error handlers, rate limiting
  database/     async engine/session
  scripts/      seed_data.py
alembic/        migrations
uploads/        local file storage (avatars/attachments/group_images)
Dockerfile
```
