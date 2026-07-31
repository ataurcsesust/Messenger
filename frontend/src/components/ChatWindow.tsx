import { useEffect, useRef, useState } from "react";
import { MoreVertical, MessageCircleOff, Phone } from "lucide-react";
import { Avatar } from "./Avatar";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";
import type { ConversationListItem, MessageOut } from "../types";
import { formatDateSeparator, formatLastSeen, isSameDay } from "../utils/date";
import { useAuth } from "../context/AuthContext";

interface ChatWindowProps {
  conversation: ConversationListItem;
  messages: MessageOut[];
  typingUserName: string | null;
  loadingMessages: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onSendText: (content: string, replyToId?: string) => void;
  onSendFile: (file: File) => void;
  onTyping: () => void;
  onStopTyping: () => void;
  onEdit: (id: string, content: string) => void;
  onDeleteForMe: (id: string) => void;
  onDeleteForEveryone: (id: string) => void;
  onReact: (id: string, emoji: string) => void;
  onPin: (id: string, pinned: boolean) => void;
  onForward: (message: MessageOut) => void;
  onOpenGroupSettings: () => void;
  onStartCall: () => void;
  readByOthers: Set<string>;
}

export function ChatWindow({
  conversation,
  messages,
  typingUserName,
  loadingMessages,
  hasMore,
  onLoadMore,
  onSendText,
  onSendFile,
  onTyping,
  onStopTyping,
  onEdit,
  onDeleteForMe,
  onDeleteForEveryone,
  onReact,
  onPin,
  onForward,
  onOpenGroupSettings,
  onStartCall,
  readByOthers,
}: ChatWindowProps) {
  const { user } = useAuth();
  const [replyingTo, setReplyingTo] = useState<MessageOut | null>(null);
  const [editingMessage, setEditingMessage] = useState<MessageOut | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevMessageCount = useRef(0);

  useEffect(() => {
    // Auto-scroll to bottom on new messages, but not when loading older history.
    if (messages.length > prevMessageCount.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevMessageCount.current = messages.length;
  }, [messages.length]);

  function handleScroll() {
    if (scrollRef.current && scrollRef.current.scrollTop < 80 && hasMore && !loadingMessages) {
      onLoadMore();
    }
  }

  const name = conversation.is_group ? conversation.name ?? "Group" : conversation.other_user?.full_name ?? "Unknown";
  const avatarSrc = conversation.is_group ? conversation.group_image_url : conversation.other_user?.avatar_url;
  const isOnline = !conversation.is_group && !!conversation.other_user?.is_online;
  const subtitle = conversation.is_group
    ? "Group chat"
    : isOnline
    ? "Online"
    : conversation.other_user?.last_seen
    ? `Last seen ${formatLastSeen(conversation.other_user.last_seen)}`
    : "Offline";

  return (
    <div className="flex-1 flex flex-col h-full min-w-0">
      <header className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-base-200/60 dark:border-base-700/60 bg-white/70 dark:bg-base-900/70 backdrop-blur-xl">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar name={name} src={avatarSrc} isOnline={isOnline} />
          <div className="min-w-0">
            <p className="font-medium text-base-900 dark:text-base-50 truncate">{name}</p>
            <p className="text-xs text-base-500 dark:text-base-400 truncate">
              {typingUserName ? <span className="text-bubble-sent dark:text-bubble-sent-dark">{typingUserName} is typing…</span> : subtitle}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!conversation.is_group && (
            <button
              onClick={onStartCall}
              disabled={!isOnline}
              className="p-2 rounded-full hover:bg-base-200 dark:hover:bg-base-800 text-base-500 dark:text-base-400 disabled:opacity-30 disabled:cursor-not-allowed"
              title={isOnline ? "Start a voice call" : "User is offline"}
            >
              <Phone className="h-5 w-5" />
            </button>
          )}
          <button
            onClick={conversation.is_group ? onOpenGroupSettings : undefined}
            className={`p-2 rounded-full hover:bg-base-200 dark:hover:bg-base-800 text-base-500 ${!conversation.is_group ? "opacity-40 cursor-default" : ""}`}
            title={conversation.is_group ? "Group settings" : undefined}
          >
            <MoreVertical className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-3 py-4">
        {loadingMessages && (
          <p className="text-center text-xs text-base-400 py-2">Loading earlier messages…</p>
        )}

        {messages.length === 0 && !loadingMessages ? (
          <div className="h-full flex flex-col items-center justify-center text-base-400 dark:text-base-500">
            <MessageCircleOff className="h-10 w-10 mb-2 opacity-50" />
            <p className="text-sm">No messages yet. Say hello!</p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const prev = messages[i - 1];
            const showDateSeparator = !prev || !isSameDay(prev.created_at, msg.created_at);
            return (
              <div key={msg.id}>
                {showDateSeparator && (
                  <div className="flex items-center justify-center my-3">
                    <span className="text-[11px] font-medium text-base-400 dark:text-base-500 bg-base-100/80 dark:bg-base-800/80 rounded-full px-3 py-1">
                      {formatDateSeparator(msg.created_at)}
                    </span>
                  </div>
                )}
                <MessageBubble
                  message={msg}
                  isOwn={msg.sender_id === user?.id}
                  isRead={readByOthers.has(msg.id)}
                  onReply={setReplyingTo}
                  onEdit={setEditingMessage}
                  onDeleteForMe={onDeleteForMe}
                  onDeleteForEveryone={onDeleteForEveryone}
                  onReact={onReact}
                  onPin={onPin}
                  onForward={onForward}
                />
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <MessageInput
        onSendText={(content) => {
          onSendText(content, replyingTo?.id);
          setReplyingTo(null);
        }}
        onSendFile={onSendFile}
        onTyping={onTyping}
        onStopTyping={onStopTyping}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
        editingMessage={editingMessage}
        onCancelEdit={() => setEditingMessage(null)}
        onSubmitEdit={(content) => {
          if (editingMessage) onEdit(editingMessage.id, content);
          setEditingMessage(null);
        }}
      />
    </div>
  );
}
