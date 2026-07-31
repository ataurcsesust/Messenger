# Messenger Clone — Frontend

React (Vite) + TypeScript + Tailwind CSS v4 frontend for the Messenger-clone backend.

## Setup

```bash
npm install
cp .env.example .env
# Edit .env if your backend isn't at http://localhost:8000

npm run dev
```

Open http://localhost:5173. Make sure the backend is running first — see
`../backend/README.md`. Log in with a seeded account (`alice` /
`Password123`, if you ran the backend's seed script) or register a new one.

## What's implemented

- **Auth**: register, login, logout, silent access-token refresh on 401 (axios interceptor, with request queuing so concurrent 401s don't race the rotating refresh token)
- **Chat list**: search, unread badges, pinned/muted/archived indicators, loading skeletons, empty states
- **Real-time messaging**: WebSocket connection with auto-reconnect (exponential backoff); live message delivery, typing indicators, presence (online/last-seen), read receipts, live in-app + browser notifications with sound
- **Optimistic UI**: sent text messages appear instantly and reconcile with the server response (or roll back on failure), deduped against the WebSocket echo
- **Messages**: text, image/video/audio/document attachments **with a preview-and-caption step before sending** (including voice recordings), reply, edit, delete-for-me, delete-for-everyone, react (emoji), pin, forward (with a real conversation picker), copy, date separators, infinite-scroll-up pagination
- **Groups**: create group, full group settings modal — real member list, add/remove members, promote/demote roles (owner/admin/member), edit name & description
- **Notifications**: live WebSocket-driven browser notifications (only when the tab isn't focused) plus a short generated sound (Web Audio — no external audio asset)
- **Settings**: profile edit, avatar upload, privacy toggles (last-seen / read-receipts visibility), change password
- **UI**: dark/light mode (persisted), glassmorphism panels, custom Tailwind v4 theme tokens, smooth message-enter and typing-dot animations (respects `prefers-reduced-motion`)
- **Voice calling**: 1:1 WebRTC audio calls (`useCall` hook) — call button in the chat header (disabled when the other user is offline), ringing UI for both sides (with a generated ringtone), accept/reject, live call-duration timer, mute/unmute, call-ended state with auto-dismiss, call history modal with call-back, microphone permission handling with a clear error message on denial, and browser-tab-safe reconnect handling for the underlying WebSocket. **Verified with a real two-browser Playwright test** (see the backend README's Verified section) — not just built, actually run.

## Known simplifications (be aware before treating this as finished)

- **Emoji picker** is a small curated grid, not a full searchable emoji
  library.
- **Group photo upload** — the backend model supports `group_image_url`
  but there's no upload control for it in the group settings modal yet
  (avatar upload for user profiles works; group images don't yet).
- **CSRF protection**: the backend currently relies on JWT bearer tokens
  (not cookies), so classic CSRF doesn't apply to it as built. If you
  switch to httpOnly cookie storage for tokens, add CSRF tokens then.
- **Search messages** (full-text search within a conversation's history)
  isn't built — only search-users and search-conversations-by-name exist.
- **Calling**: audio only, 1:1 only, no call-waiting/hold, and only
  public STUN servers are configured (see the backend README for the
  TURN-server caveat on restrictive NATs). There's also no call-in-
  progress indicator elsewhere in the UI (e.g. on the chat-list row) —
  it's only visible via the full-screen call overlay.

## Project structure

```
src/
  components/   Sidebar, ChatWindow, MessageBubble, MessageInput, Avatar,
                EmojiPicker, NewChatModal, SettingsModal,
                GroupSettingsModal, ForwardModal
  pages/        Login, Register, Chat
  context/      AuthContext, ThemeContext
  hooks/        useWebSocket, useBrowserNotifications
  services/     api.ts (axios + refresh interceptor), chatApi.ts
  routes/       ProtectedRoute
  types/        shared TypeScript types matching backend schemas
  utils/        date formatting helpers
```

## Build

```bash
npm run build   # type-checks with tsc -b, then builds with vite
```

Verified: this builds cleanly with zero TypeScript errors (re-verified
after adding group settings, forward picker, browser notifications, and
attachment preview).

## Docker

```bash
docker build -t messenger-frontend --build-arg VITE_API_BASE_URL=http://localhost:8000 .
docker run -p 5173:80 messenger-frontend
```

Or use the root `docker-compose.yml`, which builds and wires this up
together with the backend and Postgres.
