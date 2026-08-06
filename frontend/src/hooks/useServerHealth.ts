import { useEffect, useRef, useState, useCallback } from "react";
import axios from "axios";
import { API_BASE_URL } from "../services/api";

export function useServerHealth() {
  const [isServerWaking, setIsServerWaking] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onServerRecoverCallbacks = useRef<Array<() => void>>([]);

  const registerOnServerRecover = useCallback((cb: () => void) => {
    onServerRecoverCallbacks.current.push(cb);
  }, []);

  const checkHealth = useCallback(async (): Promise<boolean> => {
    if (!navigator.onLine) {
      setIsOffline(true);
      return false;
    }
    setIsOffline(false);
    try {
      const res = await axios.get(`${API_BASE_URL}/health`, { timeout: 5000 });
      if (res.status === 200) {
        if (isServerWaking) {
          setIsServerWaking(false);
          onServerRecoverCallbacks.current.forEach((cb) => cb());
        }
        return true;
      }
    } catch {
      setIsServerWaking(true);
      return false;
    }
    return false;
  }, [isServerWaking]);

  const markServerDown = useCallback(() => {
    if (!navigator.onLine) {
      setIsOffline(true);
    } else {
      setIsServerWaking(true);
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      checkHealth();
    };
    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [checkHealth]);

  useEffect(() => {
    if (isServerWaking && !isOffline) {
      pollTimerRef.current = setInterval(async () => {
        const healthy = await checkHealth();
        if (healthy && pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
      }, 3500);
    } else if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [isServerWaking, isOffline, checkHealth]);

  return {
    isServerWaking,
    isOffline,
    markServerDown,
    checkHealth,
    registerOnServerRecover,
  };
}
