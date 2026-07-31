import { useState } from "react";
import { X, Search, Users } from "lucide-react";
import { Avatar } from "./Avatar";
import { chatApi } from "../services/chatApi";
import type { UserPublic } from "../types";

interface NewChatModalProps {
  onClose: () => void;
  onCreated: (conversationId: string) => void;
}

export function NewChatModal({ onClose, onCreated }: NewChatModalProps) {
  const [mode, setMode] = useState<"direct" | "group">("direct");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserPublic[]>([]);
  const [selected, setSelected] = useState<UserPublic[]>([]);
  const [groupName, setGroupName] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSearch(q: string) {
    setQuery(q);
    if (q.trim().length < 1) {
      setResults([]);
      return;
    }
    const users = await chatApi.searchUsers(q.trim());
    setResults(users.filter((u) => !selected.some((s) => s.id === u.id)));
  }

  function toggleSelect(user: UserPublic) {
    if (mode === "direct") {
      setSelected([user]);
      return;
    }
    setSelected((prev) => (prev.some((u) => u.id === user.id) ? prev.filter((u) => u.id !== user.id) : [...prev, user]));
  }

  async function handleCreate() {
    if (selected.length === 0) return;
    setLoading(true);
    try {
      if (mode === "direct") {
        const conv = await chatApi.createDirectConversation(selected[0].id);
        onCreated(conv.id);
      } else {
        if (!groupName.trim()) return;
        const conv = await chatApi.createGroup(
          groupName.trim(),
          selected.map((u) => u.id)
        );
        onCreated(conv.id);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center px-4">
      <div className="bg-white dark:bg-base-900 rounded-2xl w-full max-w-md shadow-2xl border border-base-200 dark:border-base-700 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-base-200 dark:border-base-700">
          <h2 className="font-semibold text-base-900 dark:text-base-50">New conversation</h2>
          <button onClick={onClose} className="text-base-400 hover:text-base-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex px-5 pt-4 gap-2">
          <button
            onClick={() => { setMode("direct"); setSelected([]); }}
            className={`flex-1 py-1.5 rounded-lg text-sm font-medium ${mode === "direct" ? "bg-bubble-sent dark:bg-bubble-sent-dark text-white" : "bg-base-100 dark:bg-base-800 text-base-600 dark:text-base-300"}`}
          >
            Direct message
          </button>
          <button
            onClick={() => { setMode("group"); setSelected([]); }}
            className={`flex-1 py-1.5 rounded-lg text-sm font-medium flex items-center justify-center gap-1 ${mode === "group" ? "bg-bubble-sent dark:bg-bubble-sent-dark text-white" : "bg-base-100 dark:bg-base-800 text-base-600 dark:text-base-300"}`}
          >
            <Users className="h-3.5 w-3.5" /> Group
          </button>
        </div>

        <div className="p-5 space-y-3">
          {mode === "group" && (
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group name"
              className="w-full rounded-xl border border-base-300 dark:border-base-700 bg-white dark:bg-base-800 px-3 py-2 text-base-900 dark:text-base-50 focus:outline-none focus:ring-2 focus:ring-bubble-sent"
            />
          )}

          {selected.length > 0 && mode === "group" && (
            <div className="flex flex-wrap gap-1.5">
              {selected.map((u) => (
                <span
                  key={u.id}
                  onClick={() => toggleSelect(u)}
                  className="cursor-pointer text-xs bg-base-100 dark:bg-base-800 text-base-700 dark:text-base-300 rounded-full px-2.5 py-1"
                >
                  {u.full_name} ×
                </span>
              ))}
            </div>
          )}

          <div className="relative">
            <Search className="h-4 w-4 text-base-400 absolute left-3 top-2.5" />
            <input
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search by name or username"
              className="w-full rounded-xl border border-base-300 dark:border-base-700 bg-white dark:bg-base-800 pl-9 pr-3 py-2 text-base-900 dark:text-base-50 focus:outline-none focus:ring-2 focus:ring-bubble-sent"
            />
          </div>

          <div className="max-h-56 overflow-y-auto space-y-1">
            {results.map((user) => (
              <button
                key={user.id}
                onClick={() => toggleSelect(user)}
                className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-base-100 dark:hover:bg-base-800 text-left"
              >
                <Avatar name={user.full_name} src={user.avatar_url} size="sm" isOnline={user.is_online} />
                <div>
                  <div className="text-sm font-medium text-base-900 dark:text-base-50">{user.full_name}</div>
                  <div className="text-xs text-base-500 dark:text-base-400">@{user.username}</div>
                </div>
              </button>
            ))}
            {query && results.length === 0 && (
              <p className="text-sm text-base-400 text-center py-3">No users found.</p>
            )}
          </div>

          <button
            onClick={handleCreate}
            disabled={selected.length === 0 || loading || (mode === "group" && !groupName.trim())}
            className="w-full rounded-xl bg-bubble-sent dark:bg-bubble-sent-dark text-white font-medium py-2.5 disabled:opacity-50"
          >
            {mode === "direct" ? "Start conversation" : "Create group"}
          </button>
        </div>
      </div>
    </div>
  );
}
