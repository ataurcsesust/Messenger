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
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center px-4">
      <div className="bg-white dark:bg-base-900 rounded-2xl w-full max-w-md shadow-2xl border border-base-200 dark:border-base-700 overflow-hidden max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-base-200 dark:border-base-700 shrink-0">
          <h2 className="font-semibold text-base-900 dark:text-base-50">Group settings</h2>
          <button onClick={onClose} className="text-base-400 hover:text-base-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-base-700 dark:text-base-300 mb-1">Group name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canManage}
              className="w-full rounded-xl border border-base-300 dark:border-base-700 bg-white dark:bg-base-800 px-3 py-2 text-base-900 dark:text-base-50 focus:outline-none focus:ring-2 focus:ring-bubble-sent disabled:opacity-60"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-base-700 dark:text-base-300 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!canManage}
              rows={2}
              className="w-full rounded-xl border border-base-300 dark:border-base-700 bg-white dark:bg-base-800 px-3 py-2 text-base-900 dark:text-base-50 focus:outline-none focus:ring-2 focus:ring-bubble-sent disabled:opacity-60"
            />
          </div>
          {canManage && (
            <button onClick={saveInfo} className="text-sm text-bubble-sent dark:text-bubble-sent-dark font-medium hover:underline">
              Save name &amp; description
            </button>
          )}

          <hr className="border-base-200 dark:border-base-700" />

          <div>
            <label className="block text-sm font-medium text-base-700 dark:text-base-300 mb-2">
              Members {loading ? "" : `(${members.length})`}
            </label>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {members.map((m) => (
                <div key={m.user.id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-base-100 dark:hover:bg-base-800">
                  <Avatar name={m.user.full_name} src={m.user.avatar_url} size="sm" isOnline={m.user.is_online} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-base-900 dark:text-base-50 truncate flex items-center gap-1">
                      {m.user.full_name}
                      {m.role === "owner" && <Crown className="h-3 w-3 text-accent-500" />}
                      {m.role === "admin" && <ShieldCheck className="h-3 w-3 text-bubble-sent dark:text-bubble-sent-dark" />}
                    </div>
                    <div className="text-xs text-base-500 dark:text-base-400 capitalize">{m.role}</div>
                  </div>
                  {isOwner && m.user.id !== currentUserId && (
                    <select
                      value={m.role}
                      onChange={(e) => setRole(m.user.id, e.target.value as "admin" | "owner" | "member")}
                      className="text-xs rounded-lg border border-base-300 dark:border-base-700 bg-white dark:bg-base-800 text-base-700 dark:text-base-300 px-1 py-0.5"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                      <option value="owner">Owner</option>
                    </select>
                  )}
                  {canManage && m.user.id !== currentUserId && (
                    <button onClick={() => removeMember(m.user.id)} className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg" title="Remove">
                      <UserMinus className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {canManage && (
            <div>
              <label className="block text-sm font-medium text-base-700 dark:text-base-300 mb-1">Add a member</label>
              <div className="relative">
                <Search className="h-4 w-4 text-base-400 absolute left-3 top-2.5" />
                <input
                  value={query}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search by name or username"
                  className="w-full rounded-xl border border-base-300 dark:border-base-700 bg-white dark:bg-base-800 pl-9 pr-3 py-2 text-base-900 dark:text-base-50 focus:outline-none focus:ring-2 focus:ring-bubble-sent"
                />
              </div>
              {results.length > 0 && (
                <div className="mt-1 space-y-1 max-h-32 overflow-y-auto">
                  {results.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => addMember(u.id)}
                      className="w-full flex items-center gap-2 p-1.5 rounded-lg hover:bg-base-100 dark:hover:bg-base-800 text-left text-sm"
                    >
                      <Avatar name={u.full_name} src={u.avatar_url} size="sm" showStatus={false} />
                      <span className="text-base-900 dark:text-base-50">{u.full_name}</span>
                      <UserPlus className="h-3.5 w-3.5 ml-auto text-bubble-sent dark:text-bubble-sent-dark" />
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
