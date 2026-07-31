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
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center px-4">
      <div className="bg-white dark:bg-base-900 rounded-2xl w-full max-w-sm shadow-2xl border border-base-200 dark:border-base-700 overflow-hidden max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-base-200 dark:border-base-700 shrink-0">
          <h2 className="font-semibold text-base-900 dark:text-base-50">Forward message</h2>
          <button onClick={onClose} className="text-base-400 hover:text-base-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-2 text-sm text-base-500 dark:text-base-400 italic truncate border-b border-base-100 dark:border-base-800 shrink-0">
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
                className={`w-full flex items-center gap-3 p-2 rounded-xl text-left transition ${
                  checked ? "bg-bubble-sent/10 dark:bg-bubble-sent-dark/15" : "hover:bg-base-100 dark:hover:bg-base-800"
                }`}
              >
                <Avatar name={name} src={avatarSrc} size="sm" showStatus={false} />
                <span className="text-sm text-base-900 dark:text-base-50 truncate flex-1">{name}</span>
                <input type="checkbox" checked={checked} readOnly className="h-4 w-4 accent-bubble-sent" />
              </button>
            );
          })}
        </div>

        <div className="p-4 border-t border-base-200 dark:border-base-700 shrink-0">
          <button
            onClick={handleForward}
            disabled={selected.size === 0 || sending}
            className="w-full rounded-xl bg-bubble-sent dark:bg-bubble-sent-dark text-white font-medium py-2.5 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Forward className="h-4 w-4" />
            Forward to {selected.size || ""} {selected.size === 1 ? "chat" : selected.size > 1 ? "chats" : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
