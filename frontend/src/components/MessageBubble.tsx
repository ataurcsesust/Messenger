import { useState } from "react";
import { Check, CheckCheck, MoreHorizontal, Pin, Reply, Smile, Copy, Pencil, Trash2, Forward } from "lucide-react";
import type { MessageOut } from "../types";
import { formatMessageTime } from "../utils/date";
import { EmojiPicker } from "./EmojiPicker";

interface MessageBubbleProps {
  message: MessageOut;
  isOwn: boolean;
  isRead: boolean;
  onReply: (message: MessageOut) => void;
  onEdit: (message: MessageOut) => void;
  onDeleteForMe: (id: string) => void;
  onDeleteForEveryone: (id: string) => void;
  onReact: (id: string, emoji: string) => void;
  onPin: (id: string, pinned: boolean) => void;
  onForward: (message: MessageOut) => void;
}

export function MessageBubble({
  message,
  isOwn,
  isRead,
  onReply,
  onEdit,
  onDeleteForMe,
  onDeleteForEveryone,
  onReact,
  onPin,
  onForward,
}: MessageBubbleProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);

  const isDeleted = message.is_deleted_for_everyone;

  return (
    <div className={`group flex message-enter ${isOwn ? "justify-end" : "justify-start"} mb-1.5 px-1`}>
      <div className={`flex items-end gap-1.5 max-w-[70%] ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
        <div className="relative">
          {message.is_pinned && (
            <Pin className="h-3 w-3 text-accent-500 absolute -top-4 right-0 rotate-45" />
          )}
          <div
            className={`rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed ${
              isDeleted
                ? "italic text-base-400 dark:text-base-500 bg-base-100/60 dark:bg-base-800/40"
                : isOwn
                ? "bg-bubble-sent dark:bg-bubble-sent-dark text-white rounded-br-md"
                : "bg-white/80 dark:bg-base-800/80 backdrop-blur text-base-900 dark:text-base-50 border border-base-200/60 dark:border-base-700/60 rounded-bl-md"
            }`}
          >
            {message.reply_to_id && !isDeleted && (
              <div
                className={`text-xs mb-1 pl-2 border-l-2 opacity-80 ${
                  isOwn ? "border-white/50" : "border-base-400"
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
                  <div key={att.id} className="mb-1">
                    {att.mime_type.startsWith("image/") ? (
                      <img src={att.file_url} alt={att.file_name} className="rounded-lg max-w-full max-h-64 object-cover" />
                    ) : att.mime_type.startsWith("video/") ? (
                      <video src={att.file_url} controls className="rounded-lg max-w-full max-h-64" />
                    ) : att.mime_type.startsWith("audio/") ? (
                      <audio src={att.file_url} controls className="max-w-full" />
                    ) : (
                      <a
                        href={att.file_url}
                        download={att.file_name}
                        className={`flex items-center gap-2 underline text-sm ${isOwn ? "text-white" : "text-bubble-sent dark:text-bubble-sent-dark"}`}
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
              className={`flex items-center gap-1 mt-0.5 text-[10px] ${
                isOwn ? "text-white/70 justify-end" : "text-base-400 dark:text-base-500"
              }`}
            >
              {message.is_edited && !isDeleted && <span>edited</span>}
              <span>{formatMessageTime(message.created_at)}</span>
              {isOwn && !isDeleted && (isRead ? <CheckCheck className="h-3 w-3 text-sky-300" /> : <Check className="h-3 w-3" />)}
            </div>
          </div>

          {message.reactions.length > 0 && (
            <div className={`flex gap-0.5 mt-0.5 ${isOwn ? "justify-end" : "justify-start"}`}>
              <div className="bg-white dark:bg-base-800 border border-base-200 dark:border-base-700 rounded-full px-1.5 py-0.5 text-xs shadow-sm">
                {[...new Set(message.reactions.map((r) => r.emoji))].join(" ")} {message.reactions.length}
              </div>
            </div>
          )}
        </div>

        {!isDeleted && (
          <div className="relative opacity-0 group-hover:opacity-100 transition flex items-center gap-0.5">
            <button
              onClick={() => setShowEmoji((v) => !v)}
              className="p-1.5 rounded-full hover:bg-base-200 dark:hover:bg-base-700 text-base-500"
              title="React"
            >
              <Smile className="h-3.5 w-3.5" />
            </button>
            {showEmoji && (
              <EmojiPicker onSelect={(emoji) => onReact(message.id, emoji)} onClose={() => setShowEmoji(false)} />
            )}
            <button
              onClick={() => onReply(message)}
              className="p-1.5 rounded-full hover:bg-base-200 dark:hover:bg-base-700 text-base-500"
              title="Reply"
            >
              <Reply className="h-3.5 w-3.5" />
            </button>
            <div className="relative">
              <button
                onClick={() => setShowMenu((v) => !v)}
                className="p-1.5 rounded-full hover:bg-base-200 dark:hover:bg-base-700 text-base-500"
                title="More"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
              {showMenu && (
                <div
                  className="absolute z-20 top-full mt-1 right-0 bg-white dark:bg-base-800 border border-base-200 dark:border-base-700 rounded-xl shadow-lg py-1 w-44 text-sm"
                  onMouseLeave={() => setShowMenu(false)}
                >
                  <MenuItem icon={<Copy className="h-3.5 w-3.5" />} label="Copy" onClick={() => {
                    if (message.content) navigator.clipboard.writeText(message.content);
                    setShowMenu(false);
                  }} />
                  <MenuItem icon={<Forward className="h-3.5 w-3.5" />} label="Forward" onClick={() => { onForward(message); setShowMenu(false); }} />
                  <MenuItem icon={<Pin className="h-3.5 w-3.5" />} label={message.is_pinned ? "Unpin" : "Pin"} onClick={() => { onPin(message.id, !message.is_pinned); setShowMenu(false); }} />
                  {isOwn && (
                    <MenuItem icon={<Pencil className="h-3.5 w-3.5" />} label="Edit" onClick={() => { onEdit(message); setShowMenu(false); }} />
                  )}
                  <MenuItem icon={<Trash2 className="h-3.5 w-3.5" />} label="Delete for me" onClick={() => { onDeleteForMe(message.id); setShowMenu(false); }} />
                  {isOwn && (
                    <MenuItem icon={<Trash2 className="h-3.5 w-3.5" />} label="Delete for everyone" danger onClick={() => { onDeleteForEveryone(message.id); setShowMenu(false); }} />
                  )}
                </div>
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
      className={`w-full flex items-center gap-2 px-3 py-1.5 hover:bg-base-100 dark:hover:bg-base-700 text-left ${
        danger ? "text-red-600 dark:text-red-400" : "text-base-700 dark:text-base-200"
      }`}
    >
      {icon} {label}
    </button>
  );
}
