# Messenger Clone — Full-Stack Production Build

A production-ready **Messenger-inspired real-time chat application** built with **FastAPI, PostgreSQL, WebSocket, React, TypeScript, and Tailwind CSS**.

Designed as a portfolio-quality full-stack project with **real-time messaging, group chat, WebRTC voice calling, file attachments, notifications, authentication, and Docker support**.

> **Read `FINAL_REPORT.md` first** — it contains the complete feature checklist, test results, architecture notes, and known limitations.

---

## Features

### Authentication & Security

* JWT authentication (Access + Refresh tokens)
* Secure password hashing
* User registration & login
* Protected API routes
* Refresh token rotation
* Logout from active sessions

### Real-Time Messaging

* 1:1 direct messaging
* Group conversations
* WebSocket-based instant message delivery
* Typing indicators
* Online / offline presence
* Read & delivery status
* Message pagination

### Voice Calling

* WebRTC peer-to-peer voice calling
* Incoming / outgoing call signaling
* Call accept / reject
* In-call audio negotiation
* Two-browser calling support

### Messaging Features

* Edit & delete messages
* Emoji reactions
* Pinned messages
* Forward messages
* File attachments
* Image upload support

### User Experience

* Responsive Messenger-style UI
* Dark / light mode
* Browser notifications
* Conversation sidebar
* Group settings management
* Avatar support

### Production Ready

* Dockerized deployment
* PostgreSQL persistence
* Alembic database migrations
* Multi-stage frontend build (Nginx)
* Environment-based configuration

---

# Tech Stack

<Box direction="row" gap={4}><Box><Text weight="semibold">Frontend</Text><List><List.Item>React (Vite)</List.Item><List.Item>TypeScript</List.Item><List.Item>Tailwind CSS</List.Item><List.Item>Context API</List.Item><List.Item>WebRTC</List.Item></List></Box><Box><Text weight="semibold">Backend</Text><List><List.Item>FastAPI</List.Item><List.Item>PostgreSQL</List.Item><List.Item>SQLAlchemy</List.Item><List.Item>Alembic</List.Item><List.Item>JWT Authentication</List.Item><List.Item>WebSocket</List.Item></List></Box></Box>

---

# Project Structure

```text
messenger-clone/
│
├── backend/
│   ├── app/
│   │   ├── auth/
│   │   ├── database/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routers/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── websocket/
│   │   └── scripts/
│   ├── alembic/
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── pages/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── types/
│   │   └── utils/
│   ├── nginx.conf
│   └── Dockerfile
│
├── docker-compose.yml
├── FINAL_REPORT.md
└── README.md
```

---

# Quick Start

## Option A — Run with Docker (Recommended)

### 1. Clone the repository

```bash
git clone https://github.com/your-username/messenger-clone.git
cd messenger-clone
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and set a secure JWT secret:

```bash
openssl rand -hex 32
```

### 3. Start the application

```bash
docker compose up --build
```

This launches:

| Service      | URL                        |
| ------------ | -------------------------- |
| Frontend     | http://localhost:5173      |
| Backend API  | http://localhost:8000      |
| Swagger Docs | http://localhost:8000/docs |
| PostgreSQL   | localhost:5432             |

### 4. Seed demo data (optional)

```bash
docker compose exec backend python -m app.scripts.seed_data
```

This creates:

| Username | Password    |
| -------- | ----------- |
| alice    | Password123 |
| bob      | Password123 |
| carol    | Password123 |
| dave     | Password123 |

A direct conversation between **alice ↔ bob** and a sample group **Weekend Trip** are also created.

---

# Run Without Docker

## Backend

```bash
cd backend

python3 -m venv venv
source venv/bin/activate

pip install -r requirements.txt

cp .env.example .env

createdb messenger_db

alembic upgrade head

python -m app.scripts.seed_data

uvicorn app.main:app --reload
```

Backend runs at:

```text
http://localhost:8000
```

## Frontend

```bash
cd frontend

npm install

cp .env.example .env

npm run dev
```

Frontend runs at:

```text
http://localhost:5173
```

---

# Testing the Application

1. Open **http://localhost:5173**
2. Log in as **alice / Password123**
3. Open an **Incognito window**
4. Log in as **bob / Password123**
5. Send messages between the two windows

You can verify:

* Instant message delivery
* Typing indicators
* Online presence
* File sharing
* Voice calling via the phone icon
* Browser notifications

---

# API Documentation

Once the backend is running:

* **Swagger UI:** http://localhost:8000/docs
* **ReDoc:** http://localhost:8000/redoc

---

# Docker Notes

The Docker setup includes:

* PostgreSQL 16
* FastAPI backend
* Automatic Alembic migrations
* React production build
* Nginx static serving
* Persistent database volume

The application has been tested directly against a real PostgreSQL database and real WebSocket connections. Docker configuration follows standard production deployment practices.

---

# Screenshots

*Add screenshots or GIF demos here*

```text
assets/
├── login.png
├── chat.png
├── group-chat.png
├── voice-call.png
└── dark-mode.png
```

---

# Current Status

This project is **functional and production-oriented**, including:

* Real-time messaging
* Group chat
* WebRTC voice calls
* File attachments
* JWT authentication
* Notifications
* Docker deployment

It is **not intended to be a pixel-perfect clone of Facebook Messenger**, but rather a **fully working Messenger-inspired full-stack application** suitable for learning, deployment, and portfolio presentation.

For the exact implementation status of every feature, see **`FINAL_REPORT.md`**.

---

# License

This project is available for educational and portfolio purposes.

---

# Author

**Md Ataur Rahman**

If you found this project useful, consider giving it a **GitHub Star**.
