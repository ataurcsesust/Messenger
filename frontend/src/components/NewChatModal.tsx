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
    <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-50 flex items-center justify-center px-4 transition-opacity duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors duration-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="font-semibold text-slate-900 dark:text-slate-100 text-base">New conversation</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex px-5 pt-4 gap-2">
          <button
            onClick={() => { setMode("direct"); setSelected([]); }}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition ${
              mode === "direct"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            Direct message
          </button>
          <button
            onClick={() => { setMode("group"); setSelected([]); }}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
              mode === "group"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
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
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}

          {selected.length > 0 && mode === "group" && (
            <div className="flex flex-wrap gap-1.5">
              {selected.map((u) => (
                <span
                  key={u.id}
                  onClick={() => toggleSelect(u)}
                  className="cursor-pointer text-xs font-medium bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-full px-2.5 py-1 flex items-center gap-1 hover:bg-red-50 hover:text-red-600 transition"
                >
                  {u.full_name} ×
                </span>
              ))}
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500 pointer-events-none" size={18} />
            <input
              type="text"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search by name or username"
              className="w-full rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 pl-10 pr-4 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-800 transition duration-200"
            />
          </div>


          <div className="max-h-56 overflow-y-auto space-y-1">
            {results.map((user) => (
              <button
                key={user.id}
                onClick={() => toggleSelect(user)}
                className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition"
              >
                <Avatar name={user.full_name} src={user.avatar_url} size="sm" isOnline={user.is_online} />
                <div>
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{user.full_name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">@{user.username}</div>
                </div>
              </button>
            ))}
            {query && results.length === 0 && (
              <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4 font-medium">No users found.</p>
            )}
          </div>

          <button
            onClick={handleCreate}
            disabled={selected.length === 0 || loading || (mode === "group" && !groupName.trim())}
            className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-2.5 shadow-xs disabled:opacity-50 transition"
          >
            {mode === "direct" ? "Start conversation" : "Create group"}
          </button>
        </div>
      </div>
    </div>
  );
}

