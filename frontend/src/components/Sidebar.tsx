import { useState } from "react";
import { Search, SquarePen, Moon, Sun, LogOut, Settings, Pin, BellOff, Phone } from "lucide-react";
import { Avatar } from "./Avatar";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
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
}

export function Sidebar({ conversations, activeId, onSelect, onNewChat, onOpenSettings, onOpenCallHistory, loading, connectionStatus = "connected" }: SidebarProps) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [search, setSearch] = useState("");
  const [showUserMenu, setShowUserMenu] = useState(false);

  const filtered = conversations.filter((c) => {
    const name = c.is_group ? c.name ?? "Group" : c.other_user?.full_name ?? "";
    return name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <aside className="w-full sm:w-80 shrink-0 h-full flex flex-col bg-white/60 dark:bg-base-900/60 backdrop-blur-xl border-r border-base-200/60 dark:border-base-700/60">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-base-200/60 dark:border-base-700/60">
        <div className="relative flex items-center gap-2">
          <button onClick={() => setShowUserMenu((v) => !v)}>
            <Avatar name={user?.full_name ?? "?"} src={user?.avatar_url} isOnline showStatus={false} size="sm" />
          </button>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-base-100 dark:bg-base-800 border border-base-200 dark:border-base-700">
            <span
              className={`h-2 w-2 rounded-full ${
                connectionStatus === "connected"
                  ? "bg-emerald-500"
                  : connectionStatus === "reconnecting"
                  ? "bg-amber-500 animate-ping"
                  : "bg-red-500"
              }`}
            />
            <span className="capitalize text-base-600 dark:text-base-300">
              {connectionStatus}
            </span>
          </div>
          {showUserMenu && (
            <div
              className="absolute z-30 top-full mt-2 left-0 bg-white dark:bg-base-800 border border-base-200 dark:border-base-700 rounded-xl shadow-lg py-1 w-48 text-sm"
              onMouseLeave={() => setShowUserMenu(false)}
            >
              <div className="px-3 py-2 border-b border-base-100 dark:border-base-700">
                <p className="font-medium text-base-900 dark:text-base-50 truncate">{user?.full_name}</p>
                <p className="text-xs text-base-500 dark:text-base-400 truncate">@{user?.username}</p>
              </div>
              <button
                onClick={() => { onOpenSettings(); setShowUserMenu(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-base-100 dark:hover:bg-base-700 text-base-700 dark:text-base-200"
              >
                <Settings className="h-4 w-4" /> Settings
              </button>
              <button
                onClick={logout}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-base-100 dark:hover:bg-base-700 text-red-600 dark:text-red-400"
              >
                <LogOut className="h-4 w-4" /> Log out
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full hover:bg-base-200 dark:hover:bg-base-800 text-base-500 dark:text-base-400"
            title="Toggle theme"
          >
            {theme === "light" ? <Moon className="h-4.5 w-4.5" /> : <Sun className="h-4.5 w-4.5" />}
          </button>
          <button
            onClick={onOpenCallHistory}
            className="p-2 rounded-full hover:bg-base-200 dark:hover:bg-base-800 text-base-500 dark:text-base-400"
            title="Call history"
          >
            <Phone className="h-4.5 w-4.5" />
          </button>
          <button
            onClick={onNewChat}
            className="p-2 rounded-full hover:bg-base-200 dark:hover:bg-base-800 text-base-500 dark:text-base-400"
            title="New conversation"
          >
            <SquarePen className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>

      <div className="px-3 py-2.5">
        <div className="relative">
          <Search className="h-4 w-4 text-base-400 absolute left-3 top-2.5" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations"
            className="w-full rounded-full bg-base-100 dark:bg-base-800 pl-9 pr-3 py-2 text-sm text-base-900 dark:text-base-50 focus:outline-none focus:ring-2 focus:ring-bubble-sent"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {loading ? (
          <div className="space-y-2 px-2 pt-1">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-2 animate-pulse">
                <div className="h-11 w-11 rounded-full bg-base-200 dark:bg-base-700" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-2/3 bg-base-200 dark:bg-base-700 rounded" />
                  <div className="h-2.5 w-1/2 bg-base-200 dark:bg-base-700 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-sm text-base-400 dark:text-base-500 py-10 px-4">
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
                className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition ${
                  activeId === conv.id ? "bg-bubble-sent/10 dark:bg-bubble-sent-dark/15" : "hover:bg-base-100 dark:hover:bg-base-800"
                }`}
              >
                <Avatar name={name} src={avatarSrc} isOnline={isOnline} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm text-base-900 dark:text-base-50 truncate flex items-center gap-1">
                      {conv.is_pinned && <Pin className="h-3 w-3 text-accent-500 shrink-0" />}
                      {name}
                    </span>
                    {conv.last_message_at && (
                      <span className="text-[11px] text-base-400 shrink-0">{formatMessageTime(conv.last_message_at)}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-base-500 dark:text-base-400 truncate flex items-center gap-1">
                      {conv.is_muted && <BellOff className="h-3 w-3 shrink-0" />}
                      {conv.last_message_preview ?? "No messages yet"}
                    </span>
                    {conv.unread_count > 0 && (
                      <span className="shrink-0 min-w-[1.25rem] h-5 rounded-full bg-accent-500 text-white text-[11px] font-medium flex items-center justify-center px-1.5">
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
