import { useCallback, useEffect, useRef, useState } from "react";
import { WS_BASE_URL, tokenStorage } from "../services/api";
import type { WsEvent } from "../types";

type EventHandler = (event: WsEvent) => void;
export type WsConnectionStatus = "connected" | "reconnecting" | "offline";

export function useWebSocket(onEvent: EventHandler) {
  const [connectionStatus, setConnectionStatus] = useState<WsConnectionStatus>("reconnecting");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pongTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const intentionalCloseRef = useRef(false);

  const startHeartbeat = useCallback(() => {
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    if (pongTimeoutRef.current) clearTimeout(pongTimeoutRef.current);

    pingIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "ping" }));
        pongTimeoutRef.current = setTimeout(() => {
          console.warn("WebSocket ping timed out, reconnecting...");
          wsRef.current?.close();
        }, 10000);
      }
    }, 20000);
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (pongTimeoutRef.current) {
      clearTimeout(pongTimeoutRef.current);
      pongTimeoutRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    const token = tokenStorage.getAccess();
    if (!token) return;

    if (!navigator.onLine) {
      setConnectionStatus("offline");
    } else {
      setConnectionStatus("reconnecting");
    }

    intentionalCloseRef.current = false;
    const ws = new WebSocket(`${WS_BASE_URL}/ws?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttempt.current = 0;
      setConnectionStatus("connected");
      startHeartbeat();
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WsEvent;
        if (data.type === "pong") {
          if (pongTimeoutRef.current) {
            clearTimeout(pongTimeoutRef.current);
            pongTimeoutRef.current = null;
          }
          return;
        }
        onEventRef.current(data);
      } catch {
        // ignore malformed frames
      }
    };

    ws.onclose = () => {
      stopHeartbeat();
      wsRef.current = null;
      if (intentionalCloseRef.current) return;

      if (!navigator.onLine) {
        setConnectionStatus("offline");
      } else {
        setConnectionStatus("reconnecting");
      }

      const delay = Math.min(1000 * 2 ** reconnectAttempt.current, 15000);
      reconnectAttempt.current += 1;
      reconnectTimer.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [startHeartbeat, stopHeartbeat]);

  useEffect(() => {
    const handleOnline = () => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        reconnectAttempt.current = 0;
        connect();
      }
    };
    const handleOffline = () => {
      setConnectionStatus("offline");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    connect();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      intentionalCloseRef.current = true;
      stopHeartbeat();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect, stopHeartbeat]);

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

  return { sendTyping, sendStopTyping, send, connectionStatus, reconnect: connect };
}
