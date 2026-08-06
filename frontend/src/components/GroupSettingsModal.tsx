import { useEffect, useState, useCallback } from "react";
import { X, Crown, ShieldCheck, UserMinus, UserPlus, Search } from "lucide-react";
import { Avatar } from "./Avatar";
import { api } from "../services/api";
import { chatApi } from "../services/chatApi";
import type { UserPublic } from "../types";

interface Member {
  user: UserPublic;
  role: "member" | "admin" | "owner";
  joined_at: string;
}

interface GroupSettingsModalProps {
  conversationId: string;
  currentName: string;
  currentDescription: string | null;
  currentUserId: string;
  onClose: () => void;
  onUpdated: () => void;
}

export function GroupSettingsModal({
  conversationId,
  currentName,
  currentDescription,
  currentUserId,
  onClose,
  onUpdated,
}: GroupSettingsModalProps) {
  const [name, setName] = useState(currentName);
  const [description, setDescription] = useState(currentDescription ?? "");
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserPublic[]>([]);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Member[]>(`/conversations/${conversationId}/members`);
      setMembers(data);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const myMembership = members.find((m) => m.user.id === currentUserId);
  const canManage = myMembership?.role === "admin" || myMembership?.role === "owner";
  const isOwner = myMembership?.role === "owner";

  async function handleSearch(q: string) {
    setQuery(q);
    if (q.trim().length < 1) {
      setResults([]);
      return;
    }
    const users = await chatApi.searchUsers(q.trim());
    setResults(users.filter((u) => !members.some((m) => m.user.id === u.id)));
  }

  async function addMember(userId: string) {
    await api.post(`/conversations/${conversationId}/members`, { member_ids: [userId] });
    setQuery("");
    setResults([]);
    await loadMembers();
    onUpdated();
  }

  async function removeMember(userId: string) {
    await api.delete(`/conversations/${conversationId}/members/${userId}`);
    await loadMembers();
    onUpdated();
  }

  async function setRole(userId: string, role: "admin" | "owner" | "member") {
    await api.patch(`/conversations/${conversationId}/members/${userId}/role`, { role });
    await loadMembers();
  }

  async function saveInfo() {
    await api.patch(`/conversations/${conversationId}`, { name, description });
    onUpdated();
  }

  return (
    <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-50 flex items-center justify-center px-4 transition-opacity duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[85vh] flex flex-col transition-colors duration-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <h2 className="font-semibold text-slate-900 dark:text-slate-100 text-base">Group settings</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Group name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canManage}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!canManage}
              rows={2}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
            />
          </div>
          {canManage && (
            <button onClick={saveInfo} className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline">
              Save name &amp; description
            </button>
          )}

          <hr className="border-slate-200 dark:border-slate-800" />

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
              Members {loading ? "" : `(${members.length})`}
            </label>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {members.map((m) => (
                <div key={m.user.id} className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                  <Avatar name={m.user.full_name} src={m.user.avatar_url} size="sm" isOnline={m.user.is_online} />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate flex items-center gap-1">
                      {m.user.full_name}
                      {m.role === "owner" && <Crown className="h-3 w-3 text-amber-500" />}
                      {m.role === "admin" && <ShieldCheck className="h-3 w-3 text-blue-500" />}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 capitalize">{m.role}</div>
                  </div>
                  {isOwner && m.user.id !== currentUserId && (
                    <select
                      value={m.role}
                      onChange={(e) => setRole(m.user.id, e.target.value as "admin" | "owner" | "member")}
                      className="text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-1 focus:outline-none"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                      <option value="owner">Owner</option>
                    </select>
                  )}
                  {canManage && m.user.id !== currentUserId && (
                    <button onClick={() => removeMember(m.user.id)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition" title="Remove member" aria-label="Remove member">
                      <UserMinus className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {canManage && (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Add a member</label>
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

              {results.length > 0 && (
                <div className="mt-1 space-y-1 max-h-32 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl p-1 bg-white dark:bg-slate-800/90">
                  {results.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => addMember(u.id)}
                      className="w-full flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-left text-xs transition"
                    >
                      <Avatar name={u.full_name} src={u.avatar_url} size="sm" showStatus={false} />
                      <span className="text-slate-900 dark:text-slate-100 font-medium">{u.full_name}</span>
                      <UserPlus className="h-3.5 w-3.5 ml-auto text-blue-600 dark:text-blue-400" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

