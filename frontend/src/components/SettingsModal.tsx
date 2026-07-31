import { useRef, useState } from "react";
import { X } from "lucide-react";
import { Avatar } from "./Avatar";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { chatApi } from "../services/chatApi";

interface SettingsModalProps {
  onClose: () => void;
}

type Tab = "profile" | "privacy" | "password";

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
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center px-4">
      <div className="bg-white dark:bg-base-900 rounded-2xl w-full max-w-lg shadow-2xl border border-base-200 dark:border-base-700 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-base-200 dark:border-base-700">
          <h2 className="font-semibold text-base-900 dark:text-base-50">Settings</h2>
          <button onClick={onClose} className="text-base-400 hover:text-base-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex px-5 pt-3 gap-1 border-b border-base-200 dark:border-base-700">
          {(["profile", "privacy", "password"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setMessage(null); }}
              className={`px-3 py-2 text-sm font-medium capitalize border-b-2 -mb-px ${
                tab === t ? "border-bubble-sent dark:border-bubble-sent-dark text-bubble-sent dark:text-bubble-sent-dark" : "border-transparent text-base-500 dark:text-base-400"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-4">
          {message && <p className="text-sm text-emerald-600 dark:text-emerald-400">{message}</p>}

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
                  className="text-sm text-bubble-sent dark:text-bubble-sent-dark font-medium hover:underline"
                >
                  Change photo
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-base-700 dark:text-base-300 mb-1">Full name</label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-xl border border-base-300 dark:border-base-700 bg-white dark:bg-base-800 px-3 py-2 text-base-900 dark:text-base-50 focus:outline-none focus:ring-2 focus:ring-bubble-sent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-base-700 dark:text-base-300 mb-1">Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-base-300 dark:border-base-700 bg-white dark:bg-base-800 px-3 py-2 text-base-900 dark:text-base-50 focus:outline-none focus:ring-2 focus:ring-bubble-sent"
                />
              </div>
              <button onClick={saveProfile} disabled={saving} className="rounded-xl bg-bubble-sent dark:bg-bubble-sent-dark text-white font-medium px-4 py-2 disabled:opacity-60">
                Save profile
              </button>
            </>
          )}

          {tab === "privacy" && (
            <>
              <label className="flex items-center justify-between">
                <span className="text-sm text-base-700 dark:text-base-300">Show my last seen</span>
                <input type="checkbox" checked={showLastSeen} onChange={(e) => setShowLastSeen(e.target.checked)} className="h-4 w-4 accent-bubble-sent" />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-sm text-base-700 dark:text-base-300">Show read receipts</span>
                <input type="checkbox" checked={showReadReceipts} onChange={(e) => setShowReadReceipts(e.target.checked)} className="h-4 w-4 accent-bubble-sent" />
              </label>
              <button onClick={savePrivacy} disabled={saving} className="rounded-xl bg-bubble-sent dark:bg-bubble-sent-dark text-white font-medium px-4 py-2 disabled:opacity-60">
                Save privacy settings
              </button>
            </>
          )}

          {tab === "password" && (
            <>
              <div>
                <label className="block text-sm font-medium text-base-700 dark:text-base-300 mb-1">Current password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full rounded-xl border border-base-300 dark:border-base-700 bg-white dark:bg-base-800 px-3 py-2 text-base-900 dark:text-base-50 focus:outline-none focus:ring-2 focus:ring-bubble-sent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-base-700 dark:text-base-300 mb-1">New password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-xl border border-base-300 dark:border-base-700 bg-white dark:bg-base-800 px-3 py-2 text-base-900 dark:text-base-50 focus:outline-none focus:ring-2 focus:ring-bubble-sent"
                />
              </div>
              <button onClick={changePassword} disabled={saving} className="rounded-xl bg-bubble-sent dark:bg-bubble-sent-dark text-white font-medium px-4 py-2 disabled:opacity-60">
                Change password
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
