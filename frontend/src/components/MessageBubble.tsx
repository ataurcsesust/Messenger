import { useState } from "react";
import { Check, CheckCheck, Clock, AlertCircle, RotateCw, MoreHorizontal, Pin, Reply, Smile, Copy, Pencil, Trash2, Forward } from "lucide-react";
import type { MessageOut } from "../types";
import { formatMessageTime } from "../utils/date";
import { EmojiPicker } from "./EmojiPicker";

interface MessageBubbleProps {
  message: MessageOut;
  isOwn: boolean;
  isRead: boolean;
  isHighlighted?: boolean;
  onReply: (message: MessageOut) => void;
  onEdit: (message: MessageOut) => void;
  onDeleteForMe: (id: string) => void;
  onDeleteForEveryone: (id: string) => void;
  onReact: (id: string, emoji: string) => void;
  onPin: (id: string, pinned: boolean) => void;
  onForward: (message: MessageOut) => void;
  onRetry?: (message: MessageOut) => void;
}

export function MessageBubble({
  message,
  isOwn,
  isRead,
  isHighlighted = false,
  onReply,
  onEdit,
  onDeleteForMe,
  onDeleteForEveryone,
  onReact,
  onPin,
  onForward,
  onRetry,
}: MessageBubbleProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);

  const isDeleted = message.is_deleted_for_everyone;
  const isFailed = message.status === "failed";
  const isSending = message.status === "sending";

  const renderStatusIcon = () => {
    if (!isOwn || isDeleted) return null;
    if (isSending) return <span title="Sending..."><Clock className="h-3 w-3 animate-pulse opacity-80" /></span>;
    if (isFailed) return <span title="Failed to send"><AlertCircle className="h-3.5 w-3.5 text-red-400" /></span>;
    if (message.status === "delivered" || isRead) {
      return <CheckCheck className={`h-3 w-3 ${isRead ? "text-sky-300 dark:text-sky-300" : "opacity-80"}`} />;
    }
    return <Check className="h-3 w-3 opacity-80" />;
  };

  return (
    <div
      id={`msg-${message.id}`}
      className={`group flex message-enter ${isOwn ? "justify-end" : "justify-start"} mb-2 px-1 transition-all duration-300 ${
        isHighlighted ? "ring-2 ring-yellow-400 dark:ring-yellow-500 rounded-2xl bg-amber-500/10 p-1" : ""
      }`}
    >

      <div className={`flex items-end gap-1.5 max-w-[85%] sm:max-w-[75%] ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
        <div className="relative">
          {message.is_pinned && (
            <Pin className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400 absolute -top-4 right-0 rotate-45" />
          )}
          <div
            className={`rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed transition-colors duration-200 ${
              isDeleted
                ? "italic text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60"
                : isFailed
                ? "bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-800 text-slate-900 dark:text-slate-100 rounded-br-xs"
                : isOwn
                ? "bg-blue-600 dark:bg-blue-600 text-white rounded-br-xs shadow-xs"
                : "bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-transparent dark:border-slate-700/60 rounded-bl-xs shadow-xs"
            }`}
          >
            {message.reply_to_id && !isDeleted && (
              <div
                className={`text-xs mb-1.5 pl-2.5 border-l-2 py-0.5 rounded-r ${
                  isOwn && !isFailed
                    ? "border-white/60 bg-white/10 text-white/90"
                    : "border-blue-500 dark:border-blue-400 bg-slate-300/40 dark:bg-slate-700/40 text-slate-700 dark:text-slate-300"
                }`}
              >
                Replying to a message
              </div>
            )}

            {isDeleted ? (
              <span>This message was deleted</span>
            ) : (
              <>
                {message.attachments.map((att) => (
                  <div key={att.id} className="mb-1.5">
                    {att.mime_type.startsWith("image/") ? (
                      <img src={att.file_url} alt={att.file_name} className="rounded-xl max-w-full max-h-64 object-cover border border-black/10 dark:border-white/10" />
                    ) : att.mime_type.startsWith("video/") ? (
                      <video src={att.file_url} controls className="rounded-xl max-w-full max-h-64" />
                    ) : att.mime_type.startsWith("audio/") ? (
                      <audio src={att.file_url} controls className="max-w-full" />
                    ) : (
                      <a
                        href={att.file_url}
                        download={att.file_name}
                        className={`flex items-center gap-2 underline text-sm font-medium ${
                          isOwn && !isFailed ? "text-white" : "text-blue-600 dark:text-blue-400"
                        }`}
                      >
                        📎 {att.file_name}
                      </a>
                    )}
                  </div>
                ))}
                {message.content && <span className="whitespace-pre-wrap break-words">{message.content}</span>}
              </>
            )}

            <div
              className={`flex items-center gap-1 mt-1 text-[10px] ${
                isFailed
                  ? "text-red-500 dark:text-red-400 justify-end"
                  : isOwn
                  ? "text-white/80 justify-end"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {message.is_edited && !isDeleted && <span>edited</span>}
              <span>{formatMessageTime(message.created_at)}</span>
              {renderStatusIcon()}
            </div>
          </div>

          {isFailed && onRetry && (
            <div className="flex items-center justify-end gap-1.5 mt-1 text-xs text-red-600 dark:text-red-400 font-medium">
              <span>Failed to send</span>
              <button
                onClick={() => onRetry(message)}
                className="inline-flex items-center gap-1 px-2.5 py-1 min-h-[36px] rounded bg-red-100 dark:bg-red-900/50 hover:bg-red-200 dark:hover:bg-red-900 text-red-700 dark:text-red-300 text-[11px] font-semibold transition"
              >
                <RotateCw className="h-3 w-3" /> Retry
              </button>
            </div>
          )}

          {message.reactions.length > 0 && (
            <div className={`flex gap-0.5 mt-1 ${isOwn ? "justify-end" : "justify-start"}`}>
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-full px-2 py-0.5 text-xs shadow-xs flex items-center gap-1 font-medium">
                {[...new Set(message.reactions.map((r) => r.emoji))].join(" ")} <span>{message.reactions.length}</span>
              </div>
            </div>
          )}
        </div>

        {!isDeleted && (
          <div className="relative opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition duration-200 flex items-center gap-0.5 shrink-0">
            <button
              onClick={() => setShowEmoji((v) => !v)}
              className="p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition"
              title="React"
              aria-label="React"
            >
              <Smile className="h-4 w-4" />
            </button>
            {showEmoji && (
              <EmojiPicker onSelect={(emoji) => onReact(message.id, emoji)} onClose={() => setShowEmoji(false)} />
            )}
            <button
              onClick={() => onReply(message)}
              className="p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition"
              title="Reply"
              aria-label="Reply"
            >
              <Reply className="h-4 w-4" />
            </button>
            <div className="relative">
              <button
                onClick={() => setShowMenu((v) => !v)}
                className="p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition"
                title="More options"
                aria-label="More options"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setShowMenu(false)} />
                  <div
                    className="absolute z-30 top-full mt-1 right-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1 w-48 text-sm transition-colors duration-200"
                    onMouseLeave={() => setShowMenu(false)}
                  >
                    <MenuItem icon={<Copy className="h-4 w-4" />} label="Copy text" onClick={() => {
                      if (message.content) navigator.clipboard.writeText(message.content);
                      setShowMenu(false);
                    }} />
                    <MenuItem icon={<Forward className="h-4 w-4" />} label="Forward" onClick={() => { onForward(message); setShowMenu(false); }} />
                    <MenuItem icon={<Pin className="h-4 w-4" />} label={message.is_pinned ? "Unpin" : "Pin"} onClick={() => { onPin(message.id, !message.is_pinned); setShowMenu(false); }} />
                    {isOwn && (
                      <MenuItem icon={<Pencil className="h-4 w-4" />} label="Edit" onClick={() => { onEdit(message); setShowMenu(false); }} />
                    )}
                    <MenuItem icon={<Trash2 className="h-4 w-4" />} label="Delete for me" onClick={() => { onDeleteForMe(message.id); setShowMenu(false); }} />
                    {isOwn && (
                      <MenuItem icon={<Trash2 className="h-4 w-4" />} label="Delete for everyone" danger onClick={() => { onDeleteForEveryone(message.id); setShowMenu(false); }} />
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MenuItem({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 min-h-[40px] text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-700/80 text-left transition ${
        danger ? "text-red-600 dark:text-red-400" : "text-slate-700 dark:text-slate-200"
      }`}
    >
      <span className="shrink-0 text-slate-500 dark:text-slate-400">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

