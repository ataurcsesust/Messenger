import { useRef, useState } from "react";
import { X } from "lucide-react";
import { Avatar } from "./Avatar";
import { ThemeToggle } from "./ThemeToggle";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { chatApi } from "../services/chatApi";

interface SettingsModalProps {
  onClose: () => void;
}

type Tab = "profile" | "appearance" | "privacy" | "password";

export function SettingsModal({ onClose }: SettingsModalProps) {
  const { user, refreshMe } = useAuth();
  const [tab, setTab] = useState<Tab>("profile");
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [showLastSeen, setShowLastSeen] = useState(user?.show_last_seen ?? true);
  const [showReadReceipts, setShowReadReceipts] = useState(user?.show_read_receipts ?? true);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function saveProfile() {
    setSaving(true);
    try {
      await chatApi.updateProfile({ full_name: fullName, bio });
      await refreshMe();
      setMessage("Profile updated.");
    } finally {
      setSaving(false);
    }
  }

  async function savePrivacy() {
    setSaving(true);
    try {
      await chatApi.updateProfile({ show_last_seen: showLastSeen, show_read_receipts: showReadReceipts } as any);
      await refreshMe();
      setMessage("Privacy settings updated.");
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    setSaving(true);
    setMessage(null);
    try {
      await api.post("/auth/change-password", { current_password: currentPassword, new_password: newPassword });
      setMessage("Password changed. You'll need to sign in again next time.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err: any) {
      setMessage(err?.response?.data?.message ?? "Could not change password.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarChange(file: File) {
    setSaving(true);
    try {
      await chatApi.uploadAvatar(file);
      await refreshMe();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-50 flex items-center justify-center px-4 transition-opacity duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors duration-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="font-semibold text-slate-900 dark:text-slate-100 text-base">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex px-5 pt-3 gap-1 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
          {(["profile", "appearance", "privacy", "password"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setMessage(null); }}
              className={`px-3.5 py-2.5 text-xs font-semibold capitalize border-b-2 transition-all -mb-px shrink-0 ${
                tab === t
                  ? "border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-4">
          {message && (
            <div className="text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl px-3.5 py-2">
              {message}
            </div>
          )}

          {tab === "profile" && (
            <>
              <div className="flex items-center gap-4">
                <Avatar name={user?.full_name ?? "?"} src={user?.avatar_url} size="lg" showStatus={false} />
                <input
                  type="file"
                  accept="image/*"
                  ref={fileRef}
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleAvatarChange(e.target.files[0])}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                >
                  Change photo
                </button>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Full name</label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-800"
                />
              </div>
              <button
                onClick={saveProfile}
                disabled={saving}
                className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2.5 shadow-xs disabled:opacity-60 transition"
              >
                Save profile
              </button>
            </>
          )}

          {tab === "appearance" && (
            <div className="space-y-3 py-1">
              <div>
                <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">Theme preference</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                  Choose your interface theme. System option dynamically adapts to your OS settings.
                </p>
                <ThemeToggle variant="segmented" />
              </div>
            </div>
          )}

          {tab === "privacy" && (
            <>
              <label className="flex items-center justify-between py-1 cursor-pointer">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Show my last seen</span>
                <input type="checkbox" checked={showLastSeen} onChange={(e) => setShowLastSeen(e.target.checked)} className="h-4 w-4 accent-blue-600 rounded" />
              </label>
              <label className="flex items-center justify-between py-1 cursor-pointer">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Show read receipts</span>
                <input type="checkbox" checked={showReadReceipts} onChange={(e) => setShowReadReceipts(e.target.checked)} className="h-4 w-4 accent-blue-600 rounded" />
              </label>
              <button
                onClick={savePrivacy}
                disabled={saving}
                className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2.5 shadow-xs disabled:opacity-60 transition mt-2"
              >
                Save privacy settings
              </button>
            </>
          )}

          {tab === "password" && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Current password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">New password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-800"
                />
              </div>
              <button
                onClick={changePassword}
                disabled={saving}
                className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2.5 shadow-xs disabled:opacity-60 transition"
              >
                Change password
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

