import { useEffect, useRef, useState } from "react";
import { MoreVertical, MessageCircleOff, Phone, ArrowLeft, Search, X, ChevronUp, ChevronDown } from "lucide-react";
import { Avatar } from "./Avatar";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";
import type { ConversationListItem, MessageOut } from "../types";
import { formatDateSeparator, formatLastSeen, isSameDay } from "../utils/date";
import { useAuth } from "../context/AuthContext";
import { chatApi } from "../services/chatApi";

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
  onRetryMessage?: (message: MessageOut) => void;
  onBack?: () => void;
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
  onRetryMessage,
  onBack,
}: ChatWindowProps) {
  const { user } = useAuth();
  const [replyingTo, setReplyingTo] = useState<MessageOut | null>(null);
  const [editingMessage, setEditingMessage] = useState<MessageOut | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MessageOut[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedSearchIdx, setSelectedSearchIdx] = useState(0);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevMessageCount = useRef(0);

  function jumpToMessage(msgId: string) {
    setHighlightedMessageId(msgId);
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    setTimeout(() => {
      setHighlightedMessageId((current) => (current === msgId ? null : current));
    }, 3000);
  }

  async function handleSearch(q: string) {
    setSearchQuery(q);
    if (!q.trim()) {
      setSearchResults([]);
      setSelectedSearchIdx(0);
      return;
    }
    setIsSearching(true);
    try {
      const results = await chatApi.searchMessages(conversation.id, q.trim());
      setSearchResults(results);
      setSelectedSearchIdx(0);
      if (results.length > 0) {
        jumpToMessage(results[0].id);
      }
    } catch (err) {
      console.error("Search failed", err);
    } finally {
      setIsSearching(false);
    }
  }

  function handlePrevResult() {
    if (searchResults.length === 0) return;
    const nextIdx = (selectedSearchIdx - 1 + searchResults.length) % searchResults.length;
    setSelectedSearchIdx(nextIdx);
    jumpToMessage(searchResults[nextIdx].id);
  }

  function handleNextResult() {
    if (searchResults.length === 0) return;
    const nextIdx = (selectedSearchIdx + 1) % searchResults.length;
    setSelectedSearchIdx(nextIdx);
    jumpToMessage(searchResults[nextIdx].id);
  }


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
    <div className="flex-1 flex flex-col h-full min-w-0 bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
      <header className="sticky top-0 z-10 flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/90 backdrop-blur-xl">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              className="sm:hidden p-2 -ml-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors flex items-center justify-center min-h-[44px] min-w-[44px] shrink-0"
              title="Back to conversations"
              aria-label="Back to conversations"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <Avatar name={name} src={avatarSrc} isOnline={isOnline} />
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 dark:text-slate-100 truncate text-sm">{name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {typingUserName ? <span className="text-blue-600 dark:text-blue-400 font-medium animate-pulse">{typingUserName} is typing…</span> : subtitle}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => {
              setShowSearch(!showSearch);
              if (showSearch) {
                setSearchQuery("");
                setSearchResults([]);
              }
            }}
            className={`p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${
              showSearch ? "bg-slate-200 dark:bg-slate-800 text-blue-600 dark:text-blue-400" : ""
            }`}
            title="Search messages"
            aria-label="Search messages"
          >
            <Search className="h-5 w-5" />
          </button>

          {!conversation.is_group && (
            <button
              onClick={onStartCall}
              disabled={!isOnline}
              className="p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              title={isOnline ? "Start a voice call" : "User is offline"}
              aria-label="Start voice call"
            >
              <Phone className="h-5 w-5" />
            </button>
          )}
          <button
            onClick={conversation.is_group ? onOpenGroupSettings : undefined}
            className={`p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${!conversation.is_group ? "opacity-40 cursor-default" : ""}`}
            title={conversation.is_group ? "Group settings" : undefined}
            aria-label="More actions"
          >
            <MoreVertical className="h-5 w-5" />
          </button>
        </div>
      </header>

      {showSearch && (
        <div className="px-4 py-2 bg-slate-100/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search in conversation..."
              className="w-full pl-9 pr-3 py-1.5 text-sm bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {searchQuery.trim() && (
            <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 shrink-0">
              {isSearching ? (
                <span>Searching...</span>
              ) : (
                <>
                  <span>
                    {searchResults.length > 0 ? `${selectedSearchIdx + 1} of ${searchResults.length}` : "No results"}
                  </span>
                  {searchResults.length > 0 && (
                    <div className="flex items-center gap-0.5 ml-1">
                      <button
                        onClick={handlePrevResult}
                        className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                        title="Previous result"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        onClick={handleNextResult}
                        className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                        title="Next result"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          <button
            onClick={() => {
              setShowSearch(false);
              setSearchQuery("");
              setSearchResults([]);
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
            title="Close search"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {loadingMessages && (
          <p className="text-center text-xs text-slate-400 dark:text-slate-500 py-2 font-medium">Loading earlier messages…</p>
        )}

        {messages.length === 0 && !loadingMessages ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
            <div className="h-16 w-16 rounded-full bg-slate-200/60 dark:bg-slate-800/60 flex items-center justify-center mb-3">
              <MessageCircleOff className="h-8 w-8 opacity-60 text-slate-500 dark:text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No messages yet. Say hello!</p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const prev = messages[i - 1];
            const showDateSeparator = !prev || !isSameDay(prev.created_at, msg.created_at);
            return (
              <div key={msg.id}>
                {showDateSeparator && (
                  <div className="flex items-center justify-center my-4">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-200/70 dark:bg-slate-800/80 rounded-full px-3 py-1 border border-slate-300/40 dark:border-slate-700/40 shadow-2xs">
                      {formatDateSeparator(msg.created_at)}
                    </span>
                  </div>
                )}
                <MessageBubble
                  message={msg}
                  isOwn={msg.sender_id === user?.id}
                  isRead={readByOthers.has(msg.id)}
                  isHighlighted={msg.id === highlightedMessageId}
                  onReply={setReplyingTo}
                  onEdit={setEditingMessage}

                  onDeleteForMe={onDeleteForMe}
                  onDeleteForEveryone={onDeleteForEveryone}
                  onReact={onReact}
                  onPin={onPin}
                  onForward={onForward}
                  onRetry={onRetryMessage}
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

