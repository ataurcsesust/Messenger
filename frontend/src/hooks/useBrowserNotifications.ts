import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Wraps the Notification Web API plus a short generated "ping" tone (via
 * Web Audio — no external audio asset needed, and nothing that could run
 * into copyright/licensing questions). Permission is requested once,
 * lazily, on first call to `notify` rather than on page load, since
 * browsers increasingly ignore/penalize load-time permission prompts.
 */
export function useBrowserNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "denied"
  );
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    return () => {
      audioCtxRef.current?.close();
    };
  }, []);

  const playPing = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) audioCtxRef.current = new AudioCtx();
      const ctx = audioCtxRef.current;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.35);
    } catch {
      // Audio isn't critical — fail silently (e.g. autoplay policy blocks it).
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return "denied" as NotificationPermission;
    if (Notification.permission === "default") {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result;
    }
    return Notification.permission;
  }, []);

  const notify = useCallback(
    async (title: string, body: string, options?: { soundOnly?: boolean }) => {
      playPing();
      if (options?.soundOnly) return;
      if (document.hasFocus()) return; // don't pop a system notification while the tab is active

      const result = await requestPermission();
      if (result === "granted") {
        new Notification(title, { body, silent: true });
      }
    },
    [playPing, requestPermission]
  );

  return { permission, requestPermission, notify, playPing };
}
