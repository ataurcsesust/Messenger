import { useState } from "react";
import { X, Forward } from "lucide-react";
import { Avatar } from "./Avatar";
import { chatApi } from "../services/chatApi";
import type { ConversationListItem, MessageOut } from "../types";

interface ForwardModalProps {
  message: MessageOut;
  conversations: ConversationListItem[];
  onClose: () => void;
  onForwarded: () => void;
}

export function ForwardModal({ message, conversations, onClose, onForwarded }: ForwardModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleForward() {
    if (selected.size === 0) return;
    setSending(true);
    try {
      await chatApi.forward(message.id, Array.from(selected));
      onForwarded();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-50 flex items-center justify-center px-4 transition-opacity duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[80vh] flex flex-col transition-colors duration-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <h2 className="font-semibold text-slate-900 dark:text-slate-100 text-base">Forward message</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-2.5 text-xs text-slate-500 dark:text-slate-400 italic truncate border-b border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50 dark:bg-slate-800/40">
          "{message.content ?? "attachment"}"
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {conversations.map((conv) => {
            const name = conv.is_group ? conv.name ?? "Group" : conv.other_user?.full_name ?? "Unknown";
            const avatarSrc = conv.is_group ? conv.group_image_url : conv.other_user?.avatar_url;
            const checked = selected.has(conv.id);
            return (
              <button
                key={conv.id}
                onClick={() => toggle(conv.id)}
                className={`w-full flex items-center gap-3 p-3 min-h-[52px] rounded-xl text-left transition duration-200 ${
                  checked ? "bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100" : "hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <Avatar name={name} src={avatarSrc} size="sm" showStatus={false} />
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate flex-1">{name}</span>
                <input type="checkbox" checked={checked} readOnly className="h-5 w-5 accent-blue-600 rounded" />
              </button>
            );
          })}
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 shrink-0">
          <button
            onClick={handleForward}
            disabled={selected.size === 0 || sending}
            className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-3 min-h-[44px] flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 transition"
          >
            <Forward className="h-4 w-4" />
            Forward to {selected.size || ""} {selected.size === 1 ? "chat" : selected.size > 1 ? "chats" : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

