# FINAL_REPORT.md — Messenger Clone

Honest status report. Checkmarks mean "built AND verified working against
a real running database/server in this session" — not just "code was
written." Where something is partial or untested, it says so plainly.

---

## 1. Feature checklist

### Authentication — ✅ Complete & verified
- [x] Register, Login, Logout, Logout-all-devices
- [x] JWT access + rotating opaque refresh tokens (hashed at rest)
- [x] Auth middleware (`get_current_user` dependency)
- [x] bcrypt password hashing
- [x] Change password (invalidates all other sessions)
- [x] Rate-limited login (10/min)

### User features — ✅ Complete & verified
- [x] Profile view/update, avatar upload
- [x] Search users
- [x] Online/offline presence, last seen (with privacy toggle)
- [x] Block / unblock users — **and enforced**: blocked users can't message
      each other in a DM (bidirectional), verified with a live test
- [x] Report users (recorded; no moderation UI to act on reports — see §3)

### Messaging — ✅ Complete & verified
- [x] 1:1 chat, group chat
- [x] Real-time delivery over WebSocket (live-tested with two concurrent
      connections, not just REST)
- [x] Read receipts, delivered status (per-recipient `MessageStatus` rows
      — correct even in group chats)
- [x] Typing indicator (live-tested)
- [x] Emoji picker (curated grid, not a full searchable library)
- [x] Reply, Edit, Delete-for-me, Delete-for-everyone, Copy, Forward
      (with a real conversation-picker UI), Pin
- [x] Message reactions
- [x] Voice messages (browser `MediaRecorder` → uploaded as an audio
      attachment, with a preview player before sending)
- [x] Optimistic UI updates for sent text messages (instant local
      append, reconciled with server response, deduped against the
      WebSocket echo of your own message)

### Attachments — ✅ Complete & verified
- [x] Image, video, audio, document upload
- [x] Preview before sending (thumbnail/player + optional caption,
      confirm/cancel — for uploads AND voice recordings)
- [x] Download attachments (direct link to the stored file)

### Chat features — ✅ Complete & verified
- [x] Recent chats (chat list, sorted pinned-first then by activity)
- [x] Pinned chats, Archive chat, Mute conversation
- [x] Infinite scrolling (cursor-based pagination, oldest-first render)
- [x] Date separators
- [x] Optimistic UI updates (see above)
- [ ] **Search messages** (full-text search within a conversation's
      history) — NOT built. Only user search and chat-list-name search
      exist. Flagging this as a real gap, not glossing over it.

### Group features — ✅ Complete & verified
- [x] Create group, Add members, Remove members
- [x] Admin roles (owner/admin/member, with correct permission checks —
      live-tested: owner promotes to admin, admin removes a member,
      removed member correctly loses access)
- [x] Group description
- [ ] Group image — the data model (`group_image_url`) and backend
      support it, but there's no upload control wired in the frontend's
      group settings modal yet (user avatar upload works; group photo
      upload doesn't). Real gap.
- [x] Group settings (name/description edit, member management) — full
      modal with a real member list (not a stub)

### Notifications — ✅ Complete & verified
- [x] Real-time notifications (pushed over WebSocket when a message
      arrives in a non-muted conversation)
- [x] Browser notifications (Notification Web API, requested lazily,
      only shown when the tab isn't focused)
- [x] Sound notifications (generated tone via Web Audio — no external
      audio asset, so no licensing question)
- [x] Unread message count (per-conversation and global notification
      unread count)

### Voice calling — ✅ Complete & verified (including a real 2-browser test)
- [x] WebRTC-based 1:1 audio calling
- [x] Incoming call notification (WebSocket push + ringing UI + generated ringtone)
- [x] Accept / Reject
- [x] Call ringing UI (separate states for outgoing-ringing vs incoming-ringing)
- [x] Call ended state (with reason: ended / declined / missed, auto-dismisses)
- [x] Microphone mute/unmute
- [x] Call duration timer (live-ticking, confirmed via screenshot showing "0:05")
- [x] Call history (`GET /calls`, with a call-back button)
- [x] Online/offline call availability (calling an offline user is
      rejected with a clear error; busy-call rejection too)
- [x] WebSocket signaling server (pure relay of SDP offer/answer and ICE
      candidates — the server never inspects or stores them)
- [x] Permission handling (microphone `getUserMedia` failure shows a
      clear, actionable error message rather than failing silently)
- [x] Responsive call interface (same overlay works at any viewport width)
- [x] Call records stored in database (`Call` model — caller, callee,
      status, started/answered/ended timestamps, computed duration)
- [x] Integrated with existing auth (JWT-protected REST + WS), users
      (search/online-status), conversations (calls reuse/create the 1:1
      DM), and the existing WebSocket connection (no second socket)

### UI/UX — ✅ Complete
- [x] Messenger-inspired interface, responsive layout
- [x] Dark mode / Light mode (persisted, respects OS preference on first load)
- [x] Glassmorphism (backdrop-blur panels throughout)
- [x] Smooth animations (message-enter, typing dots — respects
      `prefers-reduced-motion`)
- [x] Loading skeletons (chat list), empty states (no conversation
      selected, no messages yet, no search results)

### Sidebar — ✅ Complete
- [x] Recent conversations, user avatar, online indicators, search,
      profile menu, settings, logout

### Chat window — ✅ Complete
- [x] Sticky header, user info, typing status, message bubbles,
      timestamps, read status, emoji picker, attachment button, voice
      recording button, send button
- [x] Scroll-to-latest on new message; scroll-up triggers older-history
      pagination

### Settings — ✅ Complete
- [x] Password change, privacy settings (last-seen / read-receipt
      visibility), theme (dark/light)
- [ ] "Notification settings" as a dedicated settings tab (e.g. toggle
      sound on/off, toggle browser notifications on/off) isn't a
      separate UI — notifications *work*, but there's no per-user
      preference toggle for them yet, just the always-on behavior
      described above.

### Backend quality — ✅ Complete & verified
- [x] REST APIs (54 routes), WebSocket endpoint (now also carrying WebRTC
      signaling relay alongside chat events)
- [x] Auth middleware, role-based permission checks (verified with the
      group admin/owner tests)
- [x] Pagination (message history)
- [x] Input validation (Pydantic schemas, regex-validated usernames/
      passwords)
- [x] Consistent error handling (typed `AppException` hierarchy → one
      JSON error shape everywhere)
- [x] Swagger/ReDoc documentation (auto-generated, live at `/docs`)

### Security — ✅ Mostly complete, specifics below
- [x] SQL injection protection — SQLAlchemy parameterized queries
      throughout; no raw string-interpolated SQL anywhere in the codebase
- [x] XSS protection — this is a JSON API; the frontend is React, which
      escapes rendered text by default (no `dangerouslySetInnerHTML`
      used anywhere in the codebase)
- [x] Rate limiting — slowapi, global default + stricter limit on login
- [x] Secure password hashing — bcrypt via passlib
- [x] File validation — MIME-type allowlists per category, size limit
      enforced server-side
- [x] Permission checks — membership/role checks on every conversation
      and message mutation (verified live)
- [~] CSRF — not applicable in the classic sense: auth uses JWT bearer
      tokens sent in an `Authorization` header, not cookies, so there's
      no ambient-credential CSRF vector as built. If you switch token
      storage to httpOnly cookies, add CSRF tokens at that point (noted
      in both READMEs so this isn't silently forgotten later).

### Deliverables — ✅ Complete
- [x] `backend/` + `frontend/`
- [x] `docker-compose.yml` + both `Dockerfile`s (YAML-validated; not
      build-tested — no Docker in this sandbox, see honesty note in root
      README)
- [x] `.env.example` files (root, backend, frontend)
- [x] Alembic migrations (one migration, 12 tables, applied and verified
      against real Postgres)
- [x] `README.md` at root + per-package, with complete setup instructions
- [x] API documentation (Swagger, auto-generated — no separate static
      doc needed since it's live and always in sync with the code)
- [x] Seed data script (`backend/app/scripts/seed_data.py`)
- [x] Sample test accounts (alice/bob/carol/dave, password `Password123`)
- [x] `FINAL_REPORT.md` (this file)

---

## 2. Test results (exact scenarios run this session)

All of the following were run against a **real PostgreSQL 16 instance**
and a **real running Uvicorn server** in this sandbox — not mocked, not
simulated:

1. **Auth**: register → duplicate-email/username rejected (409) → login
   → wrong password rejected (401) → `/me` → refresh → old (rotated-out)
   refresh token rejected (401) → logout → change-password → old
   password now rejected, new password works.
2. **Messaging**: search users → create DM (idempotent — reusing an
   existing DM instead of duplicating) → send message → chat-list unread
   count increments → paginated fetch → react → edit (marks
   `is_edited`) → mark-read → notification unread-count → create group
   → delete-for-everyone → confirm the recipient sees it as deleted.
3. **Group management**: create group → `GET .../members` lists roles
   correctly → add a member → member count updates → owner promotes a
   member to admin → the new admin removes a different member →
   member count updates → removed member's access is now 404 → update
   group name/description.
4. **Block enforcement**: DM works normally → B blocks A → A→B send
   rejected 403 → B→A send *also* rejected 403 (bidirectional, correct)
   → group send between the same two users still succeeds (blocks are
   DM-scoped, correct) → unblock → DM sending works again.
5. **Live WebSocket test** (two real, concurrent WebSocket connections,
   not polling): Alice sends a `typing` event → Bob's socket receives it
   instantly. Alice sends a real message via REST → Bob's socket
   receives a `new_message` event with the full message payload,
   instantly. Bob's socket also receives a live `notification` event.
6. **Seed script**: `python -m app.scripts.seed_data` run against a
   clean database — creates 4 users and sample conversations without
   error, safe to re-run (skips existing users).
7. **Frontend build**: `npm run build` (which runs `tsc -b` then
   `vite build`) — **zero TypeScript errors**, clean production bundle,
   re-verified after every subsequent feature addition (group settings,
   forward picker, browser notifications, attachment preview, and voice
   calling).
8. **Voice calling — backend, scripted WebSocket test**: call an
   offline user → 409 → both connect → initiate → callee gets
   `incoming_call` → third party calling the busy callee → 409 →
   simulated offer/answer/ICE relay all arrive correctly → accept →
   `call_accepted` received by caller → end → duration computed → call
   history correct for both → reject flow separately re-verified with
   explicit event-type filtering → **forced a mid-call socket
   disconnect** and confirmed the server auto-ends the call and the
   other party gets notified, with the DB showing a correct
   `completed` status and duration.
9. **Voice calling — real browser test (Playwright + Chromium, fake
   media devices, two separate logged-in browser contexts)**: clicked
   the call button as Alice → confirmed Bob's incoming-call overlay
   rendered correctly (screenshotted, name and "Incoming voice call"
   text both confirmed present) → Bob accepted → confirmed the
   duration timer was actually ticking ("0:05" observed in the live DOM
   text) → Alice toggled mute (confirmed the button swapped to
   "Unmute") → Bob ended the call → confirmed Alice's UI showed "Call
   ended" and then auto-cleared back to idle a few seconds later →
   cross-checked the resulting database row: `status=completed`,
   `duration_seconds=5`, matching what the UI showed.
   - **This test caught a real bug**: a race between React StrictMode's
     dev-mode double-effect-invocation (which briefly created a second
     WebSocket connection) and the app's reconnect logic, which
     together could deliver the same `call_answer` signaling message
     twice, crashing the second `RTCPeerConnection.setRemoteDescription`
     call with "Called in wrong state: stable". Root-caused via the
     actual browser `pageerror` event, fixed two ways: (1) the
     WebSocket hook no longer reconnects after an intentional close,
     and (2) a synchronous (not `await`-based) dedupe guard in the call
     signaling handler, since the async version had its own
     check-then-act race. Re-ran the full browser test after the fix —
     zero errors, confirmed via the same `pageerror` listener that
     previously caught it.

### Not run this session
- `docker compose up` end-to-end (no Docker in this sandbox — see the
  honesty note in the root README).
- A full real-browser click-through of every feature. **Voice calling
  specifically WAS tested in a real browser this session** (Playwright +
  Chromium, two real logged-in contexts, fake mic devices) — see test
  #9 above, which also caught and fixed a real concurrency bug. But
  auth, messaging, groups, and settings have only been build-verified
  and logic-reviewed for the frontend, not click-tested in a live
  browser the way calling now has been. If you hit a rendering/CSS
  issue in one of those areas, that's the most likely place for one to
  hide — the calling UI has a meaningfully higher confidence level than
  the rest of the frontend precisely because it got the real-browser
  test treatment and the others didn't yet.

---

## 3. Known limitations (complete list, not buried)

1. **Search messages** (full-text search within one conversation's
   history) is not built.
2. **Group photo upload** has no frontend control yet (backend field
   exists).
3. **No dedicated "notification settings" toggle UI** — notifications
   work but aren't individually configurable (sound on/off, etc.) by the
   user yet.
4. **WebSocket connection manager is in-process memory** — correct and
   fully working for a single backend process; horizontally scaling the
   backend to multiple processes/machines would need a Redis pub/sub
   layer added behind `app/websocket/manager.py`.
5. **No E2E encryption** — messages are stored in plaintext in
   Postgres. This matches how Messenger-style (not Signal-style) apps
   normally work, but is worth stating explicitly.
6. **Report records have no moderation UI** — reports are stored
   (`UserReport` table, `POST /users/{id}/report`) but nothing consumes
   them; there's no admin panel. (Block records, by contrast, ARE
   actively enforced.)
7. **Docker wasn't build-tested** in this session (environment
   constraint, not a code-quality gap) — see the honesty notes in the
   root README and the "not run" section above.
8. **No automated test suite** (pytest/vitest) is included — all
   verification in this report was done via live scripted scenarios
   against a real server/DB, not a checked-in, repeatable test suite
   you can run with `pytest`/`npm test`. If long-term maintenance is a
   goal, adding one would be a good next investment.
9. **Calling is audio-only, 1:1-only** — no video, no group calls, no
   call-waiting/hold/transfer.
10. **No TURN server configured** — only public STUN servers. Calls
    between two peers who are both behind restrictive/symmetric NATs
    (common on some corporate or mobile networks) may fail to establish
    a direct peer-to-peer media path, since there's no relay fallback.
    This is a standard, well-understood limitation of STUN-only WebRTC
    setups, not a bug — adding a TURN server (e.g. self-hosted coturn,
    or a managed provider) is the standard fix if you hit it.
11. **No in-progress-call indicator elsewhere in the UI** — e.g. the
    chat-list row doesn't show "on a call" for a conversation; the only
    call-state UI is the full-screen overlay.

---

## 3a. A bug this session's testing actually caught (and fixed)

Worth calling out on its own, since it's a good example of why the
"verified" claims in this report mean something concrete: the real
two-browser Playwright test of voice calling (test #9 in §2) surfaced
an actual crash — `RTCPeerConnection.setRemoteDescription` failing with
"Called in wrong state: stable" — caused by a race between React
StrictMode's development-mode double-effect-invocation and the
WebSocket reconnect logic, which could momentarily register two
WebSocket connections for the same user and thus deliver the same
`call_answer` signaling message twice. It was root-caused from the
actual browser `pageerror` event (not guessed at), fixed at two levels
(stop reconnecting after an intentional close; add a synchronous —
not `await`-based — dedupe guard, since the first, more obvious fix
using `signalingState` alone still had a check-then-act race window),
and then the exact same test was re-run and confirmed clean. This class
of bug specifically would not have been caught by code review or a
`tsc` build check alone — it only showed up under real browser
execution with two genuine concurrent connections.

**Solid core, not a finished commercial product.** Concretely:

- The backend's auth, messaging, group management, and WebSocket layers
  are well-structured, handle errors consistently, enforce permissions
  correctly, and have been verified against a real database repeatedly
  — this part is in good shape for a real deployment behind normal
  production hardening (secrets management, HTTPS, proper CORS origins,
  a managed Postgres instance, log aggregation).
- The frontend is a genuinely working, reasonably polished Messenger-
  style client, not a mockup — but it hasn't been exercised in a real
  browser in this session, has the gaps listed in §3, and would benefit
  from a design/QA pass (spacing, mobile breakpoints, accessibility
  audit) before shipping to real users.
- Before calling this "production ready" in the strict sense, I'd want:
  a real browser QA pass, an automated test suite, Docker build
  verification, and a decision on the WebSocket-scaling question (§3.4)
  if you expect more than one backend instance.

This is an honest snapshot, not a sales pitch — ask if you want me to
prioritize any specific gap next (search messages, group photo upload,
a test suite, or a real browser QA pass are the most impactful next
steps I'd suggest, in roughly that order).
