import { useCallback, useEffect, useRef, useState } from "react";
import { Sidebar } from "../components/Sidebar";
import { ChatWindow } from "../components/ChatWindow";
import { NewChatModal } from "../components/NewChatModal";
import { SettingsModal } from "../components/SettingsModal";
import { ForwardModal } from "../components/ForwardModal";
import { GroupSettingsModal } from "../components/GroupSettingsModal";
import { CallOverlay } from "../components/CallOverlay";
import { CallHistoryModal } from "../components/CallHistoryModal";
import { chatApi } from "../services/chatApi";
import { useWebSocket } from "../hooks/useWebSocket";
import { useBrowserNotifications } from "../hooks/useBrowserNotifications";
import { useCall } from "../hooks/useCall";
import { useAuth } from "../context/AuthContext";
import type { ConversationListItem, MessageOut, UserPublic, WsEvent } from "../types";

export default function Chat() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messagesByConv, setMessagesByConv] = useState<Record<string, MessageOut[]>>({});
  const [hasMoreByConv, setHasMoreByConv] = useState<Record<string, boolean>>({});
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [typingByConv, setTypingByConv] = useState<Record<string, string | null>>({});
  const [readByOthers, setReadByOthers] = useState<Record<string, Set<string>>>({});
  const [showNewChat, setShowNewChat] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [forwardingMessage, setForwardingMessage] = useState<MessageOut | null>(null);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [showCallHistory, setShowCallHistory] = useState(false);
  const { notify } = useBrowserNotifications();

  const activeIdRef = useRef<string | null>(null);
  activeIdRef.current = activeId;

  // useCall needs `send` from useWebSocket, but useWebSocket needs the
  // event handler which needs to forward call_* events into useCall — a
  // circular dependency. Resolved with a ref indirection: useWebSocket
  // always dispatches through this ref, so the handler below can be
  // defined after `call` exists without needing to pass it in upfront.
  const wsEventHandlerRef = useRef<(event: WsEvent) => void>(() => {});
  const { sendTyping, sendStopTyping, send } = useWebSocket((event) => wsEventHandlerRef.current(event));
  const call = useCall({ send });

  const loadConversations = useCallback(async () => {
    const data = await chatApi.listConversations();
    setConversations(data);
    setLoadingConversations(false);
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const loadMessages = useCallback(async (conversationId: string, before?: string) => {
    setLoadingMessages(true);
    try {
      const page = await chatApi.getMessages(conversationId, before);
      setMessagesByConv((prev) => ({
        ...prev,
        [conversationId]: before ? [...page.items, ...(prev[conversationId] ?? [])] : page.items,
      }));
      setHasMoreByConv((prev) => ({ ...prev, [conversationId]: page.has_more }));
    } finally {
      setLoadingMessages(false);
    }
  }, []);

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
          setMessagesByConv((prev) => {
            const existing = prev[conv] ?? [];
            if (existing.some((m) => m.id === event.message.id)) return prev;
            return { ...prev, [conv]: [...existing, event.message] };
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
            [event.conversation_id]: (prev[event.conversation_id] ?? []).map((m) => (m.id === event.message.id ? event.message : m)),
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
            [event.conversation_id]: (prev[event.conversation_id] ?? []).map((m) => (m.id === event.message.id ? event.message : m)),
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
              c.other_user?.id === event.user_id ? { ...c, other_user: { ...c.other_user!, is_online: event.is_online } } : c
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

  const activeConversation = conversations.find((c) => c.id === activeId) ?? null;
  const activeMessages = activeId ? messagesByConv[activeId] ?? [] : [];

  async function handleSendText(content: string, replyToId?: string) {
    if (!activeId || !user) return;
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: MessageOut = {
      id: tempId,
      conversation_id: activeId,
      sender_id: user.id,
      sender: user,
      message_type: "text",
      content,
      reply_to_id: replyToId ?? null,
      is_edited: false,
      is_deleted_for_everyone: false,
      is_pinned: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      attachments: [],
      reactions: [],
    };
    setMessagesByConv((prev) => ({ ...prev, [activeId]: [...(prev[activeId] ?? []), optimisticMessage] }));
    try {
      const real = await chatApi.sendMessage(activeId, content, replyToId);
      setMessagesByConv((prev) => {
        const list = prev[activeId] ?? [];
        // The WS broadcast may have already delivered the real message
        // (it includes the sender). If so, just drop the temp placeholder
        // instead of creating a duplicate.
        if (list.some((m) => m.id === real.id)) {
          return { ...prev, [activeId]: list.filter((m) => m.id !== tempId) };
        }
        return { ...prev, [activeId]: list.map((m) => (m.id === tempId ? real : m)) };
      });
    } catch (err) {
      // Roll back the optimistic message and let the user know the send failed.
      setMessagesByConv((prev) => ({
        ...prev,
        [activeId]: (prev[activeId] ?? []).filter((m) => m.id !== tempId),
      }));
      throw err;
    }
  }

  async function handleSendFile(file: File, caption?: string) {
    if (!activeId) return;
    await chatApi.sendFile(activeId, file, caption);
  }

  return (
    <div className="h-screen flex bg-base-50 dark:bg-base-950">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={selectConversation}
        onNewChat={() => setShowNewChat(true)}
        onOpenSettings={() => setShowSettings(true)}
        onOpenCallHistory={() => setShowCallHistory(true)}
        loading={loadingConversations}
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
        />
      ) : (
        <div className="flex-1 hidden sm:flex items-center justify-center text-base-400 dark:text-base-500">
          <p>Select a conversation to start chatting.</p>
        </div>
      )}

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
