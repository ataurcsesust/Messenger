import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, WifiOff } from "lucide-react";
import { Sidebar } from "../components/Sidebar";
import { ChatWindow } from "../components/ChatWindow";
import { NewChatModal } from "../components/NewChatModal";
import { SettingsModal } from "../components/SettingsModal";
import { ForwardModal } from "../components/ForwardModal";
import { GroupSettingsModal } from "../components/GroupSettingsModal";
import { CallOverlay } from "../components/CallOverlay";
import { CallHistoryModal } from "../components/CallHistoryModal";
import { chatApi } from "../services/chatApi";
import { isNetworkError, isServerUnavailable } from "../services/api";
import { useWebSocket } from "../hooks/useWebSocket";
import { useServerHealth } from "../hooks/useServerHealth";
import { useBrowserNotifications } from "../hooks/useBrowserNotifications";
import { useCall } from "../hooks/useCall";
import { useAuth } from "../context/AuthContext";
import {
  getQueuedMessages,
  removeQueuedMessage,
  saveQueuedMessage,
  type QueuedMessage,
} from "../services/offlineQueue";
import type { ConversationListItem, MessageOut, UserPublic, WsEvent } from "../types";

const BACKOFF_DELAYS = [2000, 5000, 10000, 20000, 20000];

export default function Chat() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messagesByConv, setMessagesByConv] = useState<Record<string, MessageOut[]>>({});
  const [hasMoreByConv, setHasMoreByConv] = useState<Record<string, boolean>>({});
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [typingByConv, setTypingByConv] = useState<Record<string, string | null>>({});
  const [readByOthers, setReadByOthers] = useState<Record<string, Set<string>> >({});
  const [showNewChat, setShowNewChat] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [forwardingMessage, setForwardingMessage] = useState<MessageOut | null>(null);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [showCallHistory, setShowCallHistory] = useState(false);

  const { notify } = useBrowserNotifications();
  const { isServerWaking, isOffline, markServerDown, registerOnServerRecover } = useServerHealth();

  const activeIdRef = useRef<string | null>(null);
  activeIdRef.current = activeId;

  const retryTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const retryCountsRef = useRef<Record<string, number>>({});

  const wsEventHandlerRef = useRef<(event: WsEvent) => void>(() => {});
  const { sendTyping, sendStopTyping, send, connectionStatus } = useWebSocket((event) =>
    wsEventHandlerRef.current(event)
  );
  const call = useCall({ send });

  const loadConversations = useCallback(async () => {
    try {
      const data = await chatApi.listConversations();
      setConversations(data);
    } catch (err) {
      if (isServerUnavailable(err) || isNetworkError(err)) {
        markServerDown();
      }
    } finally {
      setLoadingConversations(false);
    }
  }, [markServerDown]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Restore queued messages from IndexedDB on startup
  useEffect(() => {
    getQueuedMessages().then((queuedItems) => {
      if (!queuedItems || queuedItems.length === 0) return;
      setMessagesByConv((prev) => {
        const next = { ...prev };
        queuedItems.forEach((item) => {
          const convList = next[item.conversationId] ?? [];
          if (!convList.some((m) => m.client_message_id === item.clientMessageId || m.id === item.clientMessageId)) {
            const restoredMsg: MessageOut = {
              id: item.clientMessageId,
              client_message_id: item.clientMessageId,
              conversation_id: item.conversationId,
              sender_id: user?.id || "",
              sender: user || undefined,
              message_type: item.messageType as any,
              content: item.content,
              reply_to_id: item.replyToId,
              status: "failed",
              is_edited: false,
              is_deleted_for_everyone: false,
              is_pinned: false,
              created_at: item.createdAt,
              updated_at: item.createdAt,
              attachments: [],
              reactions: [],
            };
            next[item.conversationId] = [...convList, restoredMsg];
          }
        });
        return next;
      });
    });
  }, [user]);

  const loadMessages = useCallback(
    async (conversationId: string, before?: string) => {
      setLoadingMessages(true);
      try {
        const page = await chatApi.getMessages(conversationId, before);
        setMessagesByConv((prev) => {
          const existing = prev[conversationId] ?? [];
          // Preserve local sending/failed messages when prepending or setting page items
          const unsentLocal = existing.filter((m) => m.status === "sending" || m.status === "failed");
          const serverItems: MessageOut[] = page.items.map((m) => ({ ...m, status: m.status ?? ("sent" as const) }));

          if (before) {
            return { ...prev, [conversationId]: [...serverItems, ...existing] };
          }
          // Filter out duplicates between server & local unsent
          const combined: MessageOut[] = [...serverItems];
          unsentLocal.forEach((m) => {
            if (!combined.some((s) => s.id === m.id || (m.client_message_id && s.client_message_id === m.client_message_id))) {
              combined.push(m);
            }
          });
          return { ...prev, [conversationId]: combined };
        });
        setHasMoreByConv((prev) => ({ ...prev, [conversationId]: page.has_more }));
      } catch (err) {
        if (isServerUnavailable(err) || isNetworkError(err)) {
          markServerDown();
        }
      } finally {
        setLoadingMessages(false);
      }
    },
    [markServerDown]
  );

  function selectConversation(id: string) {
    setActiveId(id);
    if (!messagesByConv[id]) loadMessages(id);
    chatApi.markRead(id).catch(() => {});
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unread_count: 0 } : c)));
  }

  const handleWsEvent = useCallback(
    (event: WsEvent) => {
      switch (event.type) {
        case "new_message": {
          const conv = event.conversation_id;
          const msgWithStatus = { ...event.message, status: "delivered" as const };
          setMessagesByConv((prev) => {
            const existing = prev[conv] ?? [];
            // Remove any pending/failed placeholder matching client_message_id or id
            const filtered = existing.filter(
              (m) =>
                m.id !== event.message.id &&
                (!event.message.client_message_id || m.client_message_id !== event.message.client_message_id) &&
                (!event.message.client_message_id || m.id !== event.message.client_message_id)
            );
            return { ...prev, [conv]: [...filtered, msgWithStatus] };
          });
          setConversations((prev) => {
            const isActive = activeIdRef.current === conv;
            const isOwn = event.message.sender_id === user?.id;
            const updated = prev.map((c) =>
              c.id === conv
                ? {
                    ...c,
                    last_message_preview: event.message.content ?? `Sent a ${event.message.message_type}`,
                    last_message_at: event.message.created_at,
                    unread_count: isActive || isOwn ? c.unread_count : c.unread_count + 1,
                  }
                : c
            );
            return updated.sort((a, b) => {
              if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
              return new Date(b.last_message_at ?? 0).getTime() - new Date(a.last_message_at ?? 0).getTime();
            });
          });
          if (activeIdRef.current === conv) chatApi.markRead(conv).catch(() => {});
          break;
        }
        case "message_edited": {
          setMessagesByConv((prev) => ({
            ...prev,
            [event.conversation_id]: (prev[event.conversation_id] ?? []).map((m) =>
              m.id === event.message.id ? event.message : m
            ),
          }));
          break;
        }
        case "message_deleted": {
          setMessagesByConv((prev) => ({
            ...prev,
            [event.conversation_id]: (prev[event.conversation_id] ?? []).map((m) =>
              m.id === event.message_id ? { ...m, is_deleted_for_everyone: true, content: null } : m
            ),
          }));
          break;
        }
        case "message_reaction":
        case "message_pinned": {
          setMessagesByConv((prev) => ({
            ...prev,
            [event.conversation_id]: (prev[event.conversation_id] ?? []).map((m) =>
              m.id === event.message.id ? event.message : m
            ),
          }));
          break;
        }
        case "messages_read": {
          setReadByOthers((prev) => {
            const existing = new Set(prev[event.conversation_id] ?? []);
            event.message_ids.forEach((id) => existing.add(id));
            return { ...prev, [event.conversation_id]: existing };
          });
          break;
        }
        case "presence_update": {
          setConversations((prev) =>
            prev.map((c) =>
              c.other_user?.id === event.user_id
                ? { ...c, other_user: { ...c.other_user!, is_online: event.is_online } }
                : c
            )
          );
          break;
        }
        case "typing": {
          setConversations((prevConvs) => {
            const conv = prevConvs.find((c) => c.id === event.conversation_id);
            const name = conv?.is_group ? "Someone" : conv?.other_user?.full_name ?? "Someone";
            setTypingByConv((prev) => ({ ...prev, [event.conversation_id]: name }));
            return prevConvs;
          });
          break;
        }
        case "stop_typing": {
          setTypingByConv((prev) => ({ ...prev, [event.conversation_id]: null }));
          break;
        }
        case "notification": {
          notify(event.title, event.body);
          break;
        }
        case "incoming_call":
        case "call_accepted":
        case "call_rejected":
        case "call_ended":
        case "call_offer":
        case "call_answer":
        case "call_ice_candidate": {
          call.handleCallEvent(event);
          break;
        }
      }
    },
    [user?.id, notify, call]
  );
  wsEventHandlerRef.current = handleWsEvent;

  const performSend = useCallback(
    async (msg: MessageOut, attemptCount = 0) => {
      const convId = msg.conversation_id;
      const clientMsgId = msg.client_message_id || msg.id;

      // Update status to sending in UI
      setMessagesByConv((prev) => ({
        ...prev,
        [convId]: (prev[convId] ?? []).map((m) =>
          m.id === msg.id || m.client_message_id === clientMsgId ? { ...m, status: "sending" } : m
        ),
      }));

      try {
        const real = await chatApi.sendMessage(
          convId,
          msg.content || "",
          msg.reply_to_id || undefined,
          clientMsgId
        );

        // Remove from offline IndexedDB
        await removeQueuedMessage(clientMsgId);
        if (retryTimersRef.current[clientMsgId]) {
          clearTimeout(retryTimersRef.current[clientMsgId]);
          delete retryTimersRef.current[clientMsgId];
        }
        delete retryCountsRef.current[clientMsgId];

        // Update message to sent in state
        setMessagesByConv((prev) => {
          const list = prev[convId] ?? [];
          if (list.some((m) => m.id === real.id && m.id !== msg.id)) {
            return { ...prev, [convId]: list.filter((m) => m.id !== msg.id && m.client_message_id !== clientMsgId) };
          }
          return {
            ...prev,
            [convId]: list.map((m) =>
              m.id === msg.id || m.client_message_id === clientMsgId
                ? { ...real, status: "sent", client_message_id: clientMsgId }
                : m
            ),
          };
        });
      } catch (err) {
        if (isServerUnavailable(err) || isNetworkError(err)) {
          markServerDown();
        }

        // Update message to failed in UI
        setMessagesByConv((prev) => ({
          ...prev,
          [convId]: (prev[convId] ?? []).map((m) =>
            m.id === msg.id || m.client_message_id === clientMsgId ? { ...m, status: "failed" } : m
          ),
        }));

        // Schedule automatic retry with exponential backoff if attempt < 5
        const nextAttempt = attemptCount + 1;
        retryCountsRef.current[clientMsgId] = nextAttempt;

        if (nextAttempt <= 5) {
          const delay = BACKOFF_DELAYS[nextAttempt - 1] || 20000;
          if (retryTimersRef.current[clientMsgId]) {
            clearTimeout(retryTimersRef.current[clientMsgId]);
          }
          retryTimersRef.current[clientMsgId] = setTimeout(() => {
            performSend(msg, nextAttempt);
          }, delay);
        }
      }
    },
    [markServerDown]
  );

  const handleSendText = useCallback(
    async (content: string, replyToId?: string) => {
      if (!activeId || !user) return;
      const clientMsgId = `client-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const optimisticMessage: MessageOut = {
        id: clientMsgId,
        client_message_id: clientMsgId,
        conversation_id: activeId,
        sender_id: user.id,
        sender: user,
        message_type: "text",
        content,
        reply_to_id: replyToId ?? null,
        status: "sending",
        is_edited: false,
        is_deleted_for_everyone: false,
        is_pinned: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        attachments: [],
        reactions: [],
      };

      setMessagesByConv((prev) => ({
        ...prev,
        [activeId]: [...(prev[activeId] ?? []), optimisticMessage],
      }));

      // Persist in IndexedDB offline queue
      const queuedItem: QueuedMessage = {
        clientMessageId: clientMsgId,
        conversationId: activeId,
        content,
        replyToId: replyToId ?? null,
        messageType: "text",
        createdAt: optimisticMessage.created_at,
        retryCount: 0,
      };
      await saveQueuedMessage(queuedItem);

      performSend(optimisticMessage, 0);
    },
    [activeId, user, performSend]
  );

  const handleSendFile = useCallback(
    async (file: File, caption?: string) => {
      if (!activeId || !user) return;
      const clientMsgId = `client-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const optimisticMessage: MessageOut = {
        id: clientMsgId,
        client_message_id: clientMsgId,
        conversation_id: activeId,
        sender_id: user.id,
        sender: user,
        message_type: file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : "document",
        content: caption || null,
        reply_to_id: null,
        status: "sending",
        is_edited: false,
        is_deleted_for_everyone: false,
        is_pinned: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        attachments: [
          {
            id: `att-${Date.now()}`,
            file_name: file.name,
            file_url: URL.createObjectURL(file),
            mime_type: file.type,
            file_size_bytes: file.size,
          },
        ],
        reactions: [],
      };

      setMessagesByConv((prev) => ({
        ...prev,
        [activeId]: [...(prev[activeId] ?? []), optimisticMessage],
      }));

      try {
        const real = await chatApi.sendFile(activeId, file, caption, clientMsgId);
        setMessagesByConv((prev) => {
          const list = prev[activeId] ?? [];
          return {
            ...prev,
            [activeId]: list.map((m) =>
              m.id === clientMsgId ? { ...real, status: "sent", client_message_id: clientMsgId } : m
            ),
          };
        });
      } catch (err) {
        if (isServerUnavailable(err) || isNetworkError(err)) {
          markServerDown();
        }
        setMessagesByConv((prev) => ({
          ...prev,
          [activeId]: (prev[activeId] ?? []).map((m) =>
            m.id === clientMsgId ? { ...m, status: "failed" } : m
          ),
        }));
      }
    },
    [activeId, user, markServerDown]
  );

  const handleRetryMessage = useCallback(
    (msg: MessageOut) => {
      const clientMsgId = msg.client_message_id || msg.id;
      if (retryTimersRef.current[clientMsgId]) {
        clearTimeout(retryTimersRef.current[clientMsgId]);
      }
      retryCountsRef.current[clientMsgId] = 0;
      performSend(msg, 0);
    },
    [performSend]
  );

  const isFlushingRef = useRef(false);

  // Flush offline queue when server health recovers or socket reconnects
  const flushOfflineQueue = useCallback(async () => {
    if (isFlushingRef.current) return;
    isFlushingRef.current = true;
    try {
      const queued = await getQueuedMessages();
      if (!queued || queued.length === 0) return;

      for (const item of queued) {
        const msgToResend: MessageOut = {
          id: item.clientMessageId,
          client_message_id: item.clientMessageId,
          conversation_id: item.conversationId,
          sender_id: user?.id || "",
          sender: user || undefined,
          message_type: item.messageType as any,
          content: item.content,
          reply_to_id: item.replyToId,
          status: "sending",
          is_edited: false,
          is_deleted_for_everyone: false,
          is_pinned: false,
          created_at: item.createdAt,
          updated_at: item.createdAt,
          attachments: [],
          reactions: [],
        };
        performSend(msgToResend, 0);
      }
    } finally {
      isFlushingRef.current = false;
    }
  }, [user, performSend]);

  useEffect(() => {
    registerOnServerRecover(() => {
      loadConversations();
      flushOfflineQueue();
    });
  }, [registerOnServerRecover, loadConversations, flushOfflineQueue]);

  useEffect(() => {
    if (connectionStatus === "connected") {
      flushOfflineQueue();
    }
  }, [connectionStatus, flushOfflineQueue]);

  const activeConversation = conversations.find((c) => c.id === activeId) ?? null;
  const activeMessages = activeId ? messagesByConv[activeId] ?? [] : [];

  return (
    <div className="h-screen flex flex-col bg-base-50 dark:bg-base-950 overflow-hidden">
      {/* Top Banner for Cold Start / Offline handling */}
      {isServerWaking && (
        <div className="bg-amber-500 text-white px-4 py-2 text-xs font-semibold flex items-center justify-center gap-2 shadow-md z-30 animate-pulse shrink-0">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Server is waking up. Messages will be sent automatically.</span>
        </div>
      )}
      {isOffline && (
        <div className="bg-red-500 text-white px-4 py-2 text-xs font-semibold flex items-center justify-center gap-2 shadow-md z-30 shrink-0">
          <WifiOff className="h-4 w-4" />
          <span>You are offline. Messages will be sent automatically once reconnected.</span>
        </div>
      )}

      <div className="flex-1 flex min-h-0 min-w-0">
        <Sidebar
          conversations={conversations}
          activeId={activeId}
          onSelect={selectConversation}
          onNewChat={() => setShowNewChat(true)}
          onOpenSettings={() => setShowSettings(true)}
          onOpenCallHistory={() => setShowCallHistory(true)}
          loading={loadingConversations}
          connectionStatus={connectionStatus}
        />

        {activeConversation ? (
          <ChatWindow
            conversation={activeConversation}
            messages={activeMessages}
            typingUserName={typingByConv[activeId!] ?? null}
            loadingMessages={loadingMessages}
            hasMore={!!hasMoreByConv[activeId!]}
            onLoadMore={() => {
              const oldest = activeMessages[0];
              if (oldest) loadMessages(activeId!, oldest.created_at);
            }}
            onSendText={handleSendText}
            onSendFile={handleSendFile}
            onTyping={() => activeId && sendTyping(activeId)}
            onStopTyping={() => activeId && sendStopTyping(activeId)}
            onEdit={(id, content) => chatApi.editMessage(id, content)}
            onDeleteForMe={(id) => {
              chatApi.deleteForMe(id);
              setMessagesByConv((prev) => ({
                ...prev,
                [activeId!]: (prev[activeId!] ?? []).filter((m) => m.id !== id),
              }));
            }}
            onDeleteForEveryone={(id) => chatApi.deleteForEveryone(id)}
            onReact={(id, emoji) => chatApi.react(id, emoji)}
            onPin={(id, pinned) => chatApi.pin(id, pinned)}
            onForward={(message) => setForwardingMessage(message)}
            onOpenGroupSettings={() => setShowGroupSettings(true)}
            onStartCall={() => {
              if (activeConversation?.other_user) call.startCall(activeConversation.other_user);
            }}
            readByOthers={readByOthers[activeId!] ?? new Set()}
            onRetryMessage={handleRetryMessage}
          />
        ) : (
          <div className="flex-1 hidden sm:flex items-center justify-center text-base-400 dark:text-base-500">
            <p>Select a conversation to start chatting.</p>
          </div>
        )}
      </div>

      {showNewChat && (
        <NewChatModal
          onClose={() => setShowNewChat(false)}
          onCreated={(id) => {
            setShowNewChat(false);
            loadConversations().then(() => selectConversation(id));
          }}
        />
      )}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {forwardingMessage && (
        <ForwardModal
          message={forwardingMessage}
          conversations={conversations}
          onClose={() => setForwardingMessage(null)}
          onForwarded={() => setForwardingMessage(null)}
        />
      )}
      {showGroupSettings && activeConversation && activeConversation.is_group && user && (
        <GroupSettingsModal
          conversationId={activeConversation.id}
          currentName={activeConversation.name ?? ""}
          currentDescription={null}
          currentUserId={user.id}
          onClose={() => setShowGroupSettings(false)}
          onUpdated={() => loadConversations()}
        />
      )}
      {showCallHistory && (
        <CallHistoryModal
          onClose={() => setShowCallHistory(false)}
          onCallBack={(otherUser: UserPublic) => {
            setShowCallHistory(false);
            call.startCall(otherUser);
          }}
        />
      )}
      <CallOverlay
        phase={call.phase}
        otherUser={call.otherUser}
        isOutgoing={call.isOutgoing}
        isMuted={call.isMuted}
        duration={call.duration}
        error={call.error}
        endedReason={call.endedReason}
        onAccept={call.acceptCall}
        onReject={call.rejectCall}
        onEnd={call.endCall}
        onToggleMute={call.toggleMute}
        onDismissError={call.clearError}
      />
    </div>
  );
}
