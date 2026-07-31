# Messenger Clone — Full-Stack Production Build

A Messenger-inspired real-time chat application.

- `backend/`  — FastAPI + PostgreSQL + SQLAlchemy + JWT + WebSocket
- `frontend/` — React (Vite) + TypeScript + Tailwind CSS
- `docker-compose.yml` — runs Postgres + backend + frontend together

Includes 1:1 real-time chat, group chat, WebRTC voice calling, file
attachments, notifications, and more — see `FINAL_REPORT.md` for the
exact checklist.

**Read `FINAL_REPORT.md` first** — it has the full feature checklist,
exact test results, and known limitations. This app is genuinely
functional and has been tested end-to-end against a real database, real
WebSocket connections, and (for voice calling specifically) a real
two-browser Playwright test with actual WebRTC audio negotiation — but
it isn't a pixel-perfect, 100%-parity clone of Facebook Messenger; the
report is specific about what's solid versus simplified.

---

## Option A — Run with Docker

```bash
cp .env.example .env
# Edit .env and set a real JWT_SECRET_KEY (generate one with: openssl rand -hex 32)

docker compose up --build
```

This starts three containers:
- `db` — PostgreSQL 16, with a persistent volume
- `backend` — FastAPI on http://localhost:8000 (runs `alembic upgrade head` on startup, then Uvicorn)
- `frontend` — built React app served by nginx on http://localhost:5173

Once it's up, seed some demo accounts (optional):

```bash
docker compose exec backend python -m app.scripts.seed_data
```

This creates `alice`, `bob`, `carol`, `dave` (all with password
`Password123`), a DM between alice/bob, and a group "Weekend Trip".

> **Honesty note on Docker**: the `docker-compose.yml` and both
> `Dockerfile`s follow standard, well-tested patterns (multi-stage
> frontend build served by nginx, `alembic upgrade head` on backend
> start, healthcheck-gated dependency ordering), and the compose file's
> YAML has been syntax-validated — but Docker itself is not available in
> the sandbox this was built in, so `docker compose up` was not actually
> run end-to-end here. Everything it orchestrates (migrations, the
> FastAPI app, the built frontend) **has** been verified working when
> run directly outside Docker — see `FINAL_REPORT.md` for exact test
> transcripts. If something in the Docker wiring needs a small fix on
> your machine (a path, a port, an env var), the underlying application
> is solid — please let me know what you hit and I'll fix it.

## Option B — Run manually (no Docker)

**1. Backend** — see `backend/README.md` for full detail. Quick version:
```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # edit DATABASE_URL + JWT_SECRET_KEY
createdb messenger_db
alembic upgrade head
python -m app.scripts.seed_data   # optional demo data
uvicorn app.main:app --reload
```

**2. Frontend** — see `frontend/README.md`. Quick version:
```bash
cd frontend
npm install
cp .env.example .env   # point at your backend if not localhost:8000
npm run dev
```

**3.** Open http://localhost:5173. Log in with a seeded account
(`alice` / `Password123`), open a second incognito window and log in as
`bob`, and chat between them — messages, typing indicators, and
presence update in real time. Click the phone icon in the chat header
to try a voice call between the two windows (allow microphone access
when prompted in each).

## API documentation

Once the backend is running: http://localhost:8000/docs (Swagger UI) or
http://localhost:8000/redoc.

## Sample test accounts (after running the seed script)

| Username | Password    |
|----------|-------------|
| alice    | Password123 |
| bob      | Password123 |
| carol    | Password123 |
| dave     | Password123 |

## Project structure

```
backend/
  app/
    routers/      auth, users, conversations, messages, notifications, calls
    models/       SQLAlchemy models + enums
    schemas/      Pydantic request/response schemas
    services/     business logic + local file storage
    websocket/    connection manager + /ws route
    auth/         password hashing, JWT, current-user dependency
    middleware/   error handlers, rate limiting
    database/     async engine/session
    scripts/      seed_data.py
  alembic/        migrations
  Dockerfile

frontend/
  src/
    components/   Sidebar, ChatWindow, MessageBubble, MessageInput,
                   GroupSettingsModal, ForwardModal, NewChatModal,
                   SettingsModal, Avatar, EmojiPicker, CallOverlay,
                   CallHistoryModal
    pages/         Login, Register, Chat
    context/       AuthContext, ThemeContext
    hooks/         useWebSocket, useBrowserNotifications, useCall
    services/      api.ts, chatApi.ts
    routes/        ProtectedRoute
    types/         shared TypeScript types
    utils/         date formatting
  Dockerfile
  nginx.conf

docker-compose.yml
FINAL_REPORT.md
```
