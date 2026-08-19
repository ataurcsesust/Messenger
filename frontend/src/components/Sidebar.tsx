import { useState } from "react";
import { Search, SquarePen, LogOut, Settings, Pin, BellOff, Phone } from "lucide-react";
import { Avatar } from "./Avatar";
import { ThemeToggle } from "./ThemeToggle";
import { useAuth } from "../context/AuthContext";
import type { ConversationListItem } from "../types";
import { formatMessageTime } from "../utils/date";

interface SidebarProps {
  conversations: ConversationListItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onOpenSettings: () => void;
  onOpenCallHistory: () => void;
  loading: boolean;
  connectionStatus?: "connected" | "reconnecting" | "offline";
  className?: string;
}

export function Sidebar({ conversations, activeId, onSelect, onNewChat, onOpenSettings, onOpenCallHistory, loading, connectionStatus = "connected", className }: SidebarProps) {
  const { user, logout } = useAuth();
  const [search, setSearch] = useState("");
  const [showUserMenu, setShowUserMenu] = useState(false);

  const filtered = conversations.filter((c) => {
    const name = c.is_group ? c.name ?? "Group" : c.other_user?.full_name ?? "";
    return name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <aside className={`w-full sm:w-80 shrink-0 h-full flex flex-col bg-white/80 dark:bg-slate-900/90 backdrop-blur-xl border-r border-slate-200/80 dark:border-slate-800/80 transition-colors duration-200 ${className ?? ""}`}>
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="relative flex items-center gap-2">
          <button onClick={() => setShowUserMenu((v) => !v)} className="focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full min-h-[44px] min-w-[44px] flex items-center justify-center p-1">
            <Avatar name={user?.full_name ?? "?"} src={user?.avatar_url} isOnline showStatus={false} size="sm" />
          </button>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <span
              className={`h-2 w-2 rounded-full ${
                connectionStatus === "connected"
                  ? "bg-emerald-500"
                  : connectionStatus === "reconnecting"
                  ? "bg-amber-500 animate-ping"
                  : "bg-red-500"
              }`}
            />
            <span className="capitalize text-slate-600 dark:text-slate-300">
              {connectionStatus}
            </span>
          </div>
          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setShowUserMenu(false)} />
              <div
                className="absolute z-30 top-full mt-2 left-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1 w-52 text-sm transition-colors duration-200"
                onMouseLeave={() => setShowUserMenu(false)}
              >
                <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700">
                  <p className="font-medium text-slate-900 dark:text-slate-100 truncate">{user?.full_name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">@{user?.username}</p>
                </div>
                <button
                  onClick={() => { onOpenSettings(); setShowUserMenu(false); }}
                  className="w-full flex items-center gap-2 px-3.5 py-2.5 min-h-[44px] hover:bg-slate-100 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 transition-colors"
                >
                  <Settings className="h-4 w-4 text-slate-500 dark:text-slate-400" /> Settings
                </button>
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-2 px-3.5 py-2.5 min-h-[44px] hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 transition-colors"
                >
                  <LogOut className="h-4 w-4" /> Log out
                </button>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-1">
          <ThemeToggle variant="compact" />
          <button
            onClick={onOpenCallHistory}
            className="p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50 min-h-[44px] min-w-[44px] flex items-center justify-center"
            title="Call history"
            aria-label="Call history"
          >
            <Phone className="h-4.5 w-4.5" />
          </button>
          <button
            onClick={onNewChat}
            className="p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50 min-h-[44px] min-w-[44px] flex items-center justify-center"
            title="New conversation"
            aria-label="New conversation"
          >
            <SquarePen className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>

      <div className="px-3 py-2.5">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500 pointer-events-none" size={18} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations"
            className="w-full rounded-full bg-slate-100 dark:bg-slate-800/80 border border-transparent dark:border-slate-700/50 pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-800 transition duration-200"
          />
        </div>
      </div>


      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {loading ? (
          <div className="space-y-2 px-2 pt-1">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-2 animate-pulse">
                <div className="h-11 w-11 rounded-full bg-slate-200 dark:bg-slate-800" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-2/3 bg-slate-200 dark:bg-slate-800 rounded" />
                  <div className="h-2.5 w-1/2 bg-slate-200 dark:bg-slate-800 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-sm text-slate-500 dark:text-slate-400 py-10 px-4">
            {search ? "No conversations match your search." : "No conversations yet — start one with the pencil icon above."}
          </div>
        ) : (
          filtered.map((conv) => {
            const name = conv.is_group ? conv.name ?? "Group" : conv.other_user?.full_name ?? "Unknown";
            const avatarSrc = conv.is_group ? conv.group_image_url : conv.other_user?.avatar_url;
            const isOnline = !conv.is_group && !!conv.other_user?.is_online;
            return (
              <button
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className={`w-full flex items-center gap-3 p-3 min-h-[56px] rounded-xl text-left transition duration-200 ${
                  activeId === conv.id
                    ? "bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 font-medium"
                    : "hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-900 dark:text-slate-100"
                }`}
              >
                <Avatar name={name} src={avatarSrc} isOnline={isOnline} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm text-slate-900 dark:text-slate-100 truncate flex items-center gap-1">
                      {conv.is_pinned && <Pin className="h-3 w-3 text-sky-500 shrink-0" />}
                      {name}
                    </span>
                    {conv.last_message_at && (
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0">{formatMessageTime(conv.last_message_at)}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                      {conv.is_muted && <BellOff className="h-3 w-3 shrink-0" />}
                      {conv.last_message_preview ?? "No messages yet"}
                    </span>
                    {conv.unread_count > 0 && (
                      <span className="shrink-0 min-w-[1.25rem] h-5 rounded-full bg-blue-600 text-white text-[11px] font-semibold flex items-center justify-center px-1.5 shadow-xs">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}

