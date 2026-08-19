import { useEffect } from "react";
import { PhoneOff, Mic, MicOff, PhoneIncoming } from "lucide-react";
import { Avatar } from "./Avatar";
import type { CallPhase } from "../hooks/useCall";
import type { UserPublic } from "../types";

interface CallOverlayProps {
  phase: CallPhase;
  otherUser: UserPublic | null;
  isOutgoing: boolean;
  isMuted: boolean;
  duration: number;
  error: string | null;
  endedReason: string | null;
  onAccept: () => void;
  onReject: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
  onDismissError: () => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function CallOverlay({
  phase,
  otherUser,
  isMuted,
  duration,
  error,
  endedReason,
  onAccept,
  onReject,
  onEnd,
  onToggleMute,
  onDismissError,
}: CallOverlayProps) {
  // Play a ringtone-ish pattern for incoming calls using a repeating short beep.
  useEffect(() => {
    if (phase !== "incoming-ringing") return;
    let cancelled = false;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    function ring() {
      if (cancelled) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    }
    ring();
    const interval = setInterval(ring, 1500);
    return () => {
      cancelled = true;
      clearInterval(interval);
      ctx.close();
    };
  }, [phase]);

  if (phase === "idle" && !error) return null;

  if (error && phase === "idle") {
    return (
      <div className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
        <div className="bg-red-50 dark:bg-red-950/80 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl px-4 py-2.5 text-sm shadow-xl flex items-center gap-3">
          {error}
          <button onClick={onDismissError} className="font-semibold hover:underline shrink-0 p-1 min-h-[44px] flex items-center justify-center">
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  if (!otherUser) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center px-4 py-6 overflow-y-auto transition-opacity duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-xs shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto transition-colors duration-200">
        <div className="flex flex-col items-center pt-10 pb-6 px-6">
          <Avatar name={otherUser.full_name} src={otherUser.avatar_url} size="lg" showStatus={false} />
          <h2 className="mt-4 text-lg font-bold text-slate-900 dark:text-slate-100">{otherUser.full_name}</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 font-medium">
            {phase === "outgoing-ringing" && "Ringing…"}
            {phase === "incoming-ringing" && "Incoming voice call"}
            {phase === "connecting" && "Connecting…"}
            {phase === "ongoing" && formatDuration(duration)}
            {phase === "ended" && (endedReason ?? "Call ended")}
          </p>
          {error && <p className="mt-2 text-xs text-red-500 dark:text-red-400 text-center font-medium">{error}</p>}
        </div>

        <div className="pb-8 px-6">
          {phase === "incoming-ringing" ? (
            <div className="flex items-center justify-center gap-6">
              <button
                onClick={onReject}
                className="h-14 w-14 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg transition transform hover:scale-105 active:scale-95"
                title="Decline"
                aria-label="Decline call"
              >
                <PhoneOff className="h-6 w-6" />
              </button>
              <button
                onClick={onAccept}
                className="h-14 w-14 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-lg transition animate-pulse transform hover:scale-105 active:scale-95"
                title="Accept"
                aria-label="Accept call"
              >
                <PhoneIncoming className="h-6 w-6" />
              </button>
            </div>
          ) : phase === "ended" ? (
            <div className="flex items-center justify-center">
              <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                <PhoneOff className="h-5 w-5" />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-5">
              {(phase === "ongoing" || phase === "connecting") && (
                <button
                  onClick={onToggleMute}
                  className={`h-12 w-12 rounded-full flex items-center justify-center shadow-xs transition ${
                    isMuted
                      ? "bg-amber-500 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                  title={isMuted ? "Unmute" : "Mute"}
                  aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
                >
                  {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </button>
              )}
              <button
                onClick={onEnd}
                className="h-14 w-14 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg transition transform hover:scale-105 active:scale-95"
                title="End call"
                aria-label="End call"
              >
                <PhoneOff className="h-6 w-6" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

