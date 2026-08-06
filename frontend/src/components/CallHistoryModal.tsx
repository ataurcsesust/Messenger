import { useEffect, useState } from "react";
import { X, PhoneOutgoing, PhoneIncoming, PhoneMissed, Phone } from "lucide-react";
import { Avatar } from "./Avatar";
import { callApi } from "../services/chatApi";
import type { CallHistoryItem } from "../types";
import { formatMessageTime, formatDateSeparator } from "../utils/date";

interface CallHistoryModalProps {
  onClose: () => void;
  onCallBack: (user: CallHistoryItem["other_user"]) => void;
}

function callIcon(item: CallHistoryItem) {
  if (item.status === "missed" || item.status === "rejected") {
    return <PhoneMissed className="h-4 w-4 text-red-500" />;
  }
  return item.is_outgoing ? (
    <PhoneOutgoing className="h-4 w-4 text-emerald-500" />
  ) : (
    <PhoneIncoming className="h-4 w-4 text-emerald-500" />
  );
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return ` · ${m}:${s.toString().padStart(2, "0")}`;
}

function statusLabel(item: CallHistoryItem): string {
  if (item.status === "missed") return item.is_outgoing ? "No answer" : "Missed call";
  if (item.status === "rejected") return item.is_outgoing ? "Declined" : "You declined";
  if (item.status === "cancelled") return "Cancelled";
  return item.is_outgoing ? "Outgoing" : "Incoming";
}

export function CallHistoryModal({ onClose, onCallBack }: CallHistoryModalProps) {
  const [calls, setCalls] = useState<CallHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    callApi.history().then((data) => {
      setCalls(data);
      setLoading(false);
    });
  }, []);

  return (
    <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-50 flex items-center justify-center px-4 transition-opacity duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[80vh] flex flex-col transition-colors duration-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <h2 className="font-semibold text-slate-900 dark:text-slate-100 text-base">Call history</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading ? (
            <p className="text-center text-xs text-slate-400 dark:text-slate-500 py-8 font-medium">Loading history…</p>
          ) : calls.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400 dark:text-slate-500">
              <div className="h-14 w-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-2">
                <Phone className="h-6 w-6 opacity-60" />
              </div>
              <p className="text-sm font-medium">No calls yet.</p>
            </div>
          ) : (
            calls.map((item) => (
              <button
                key={item.id}
                onClick={() => onCallBack(item.other_user)}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition duration-200"
              >
                <Avatar name={item.other_user.full_name} src={item.other_user.avatar_url} size="sm" showStatus={false} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{item.other_user.full_name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    {callIcon(item)} {statusLabel(item)}
                    {formatDuration(item.duration_seconds)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">{formatMessageTime(item.started_at)}</p>
                  <p className="text-[10px] text-slate-400/80 dark:text-slate-600">{formatDateSeparator(item.started_at)}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

