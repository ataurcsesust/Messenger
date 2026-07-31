import { useCallback, useEffect, useRef } from "react";
import { WS_BASE_URL, tokenStorage } from "../services/api";
import type { WsEvent } from "../types";

type EventHandler = (event: WsEvent) => void;

/**
 * Maintains a single WebSocket connection for the whole app lifetime,
 * with automatic reconnect (exponential backoff, capped) whenever the
 * connection drops unexpectedly — network blip, server restart, laptop
 * sleep, etc.
 *
 * Important: `intentionalCloseRef` distinguishes a deliberate close (the
 * effect's cleanup — component unmount, or React StrictMode's dev-only
 * double-invoke of effects) from a real disconnect. Without this, a
 * StrictMode-triggered mount/cleanup/remount cycle in development causes
 * the "closed" socket's onclose handler to schedule a reconnect anyway,
 * which can leave two live sockets registered for the same user for a
 * short window — and since the backend relays events to every socket a
 * user has open, that duplicates every WebSocket event the client
 * receives (message events would just re-render harmlessly, but for
 * WebRTC call signaling a duplicated call_answer/call_offer crashes
 * RTCPeerConnection, since you can't apply the same SDP twice). This was
 * caught by an actual two-browser call test, not by inspection.
 */
export function useWebSocket(onEvent: EventHandler) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const intentionalCloseRef = useRef(false);

  const connect = useCallback(() => {
    const token = tokenStorage.getAccess();
    if (!token) return;

    intentionalCloseRef.current = false;
    const ws = new WebSocket(`${WS_BASE_URL}/ws?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttempt.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WsEvent;
        onEventRef.current(data);
      } catch {
        // ignore malformed frames
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      if (intentionalCloseRef.current) return; // deliberate close (unmount/StrictMode) — don't reconnect
      const delay = Math.min(1000 * 2 ** reconnectAttempt.current, 15000);
      reconnectAttempt.current += 1;
      reconnectTimer.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      intentionalCloseRef.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((payload: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  }, []);

  const sendTyping = useCallback(
    (conversationId: string) => send({ type: "typing", conversation_id: conversationId }),
    [send]
  );
  const sendStopTyping = useCallback(
    (conversationId: string) => send({ type: "stop_typing", conversation_id: conversationId }),
    [send]
  );

  return { sendTyping, sendStopTyping, send };
}
