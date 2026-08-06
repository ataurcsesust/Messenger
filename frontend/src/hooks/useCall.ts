import { useCallback, useRef, useState } from "react";
import { callApi } from "../services/chatApi";
import { isNetworkError, isServerUnavailable, isTimeoutError } from "../services/api";
import type { UserPublic, WsEvent } from "../types";

export type CallPhase = "idle" | "outgoing-ringing" | "incoming-ringing" | "connecting" | "ongoing" | "ended";

interface UseCallOptions {
  send: (payload: Record<string, unknown>) => void;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

/**
 * Owns the full 1:1 voice call lifecycle: signaling (via the shared
 * WebSocket's `send`), the RTCPeerConnection, local mic capture, mute
 * toggling, and the call-duration timer. Chat.tsx forwards call_* /
 * incoming_call WebSocket events into `handleCallEvent`; everything else
 * (REST calls to /calls, getUserMedia, RTCPeerConnection) is internal.
 */
export function useCall({ send }: UseCallOptions) {
  const [phase, setPhase] = useState<CallPhase>("idle");
  const [callId, setCallId] = useState<string | null>(null);
  const [otherUser, setOtherUser] = useState<UserPublic | null>(null);
  const [isOutgoing, setIsOutgoing] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [endedReason, setEndedReason] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const otherUserIdRef = useRef<string | null>(null);
  const callIdRef = useRef<string | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  // Synchronous dedupe guards: WS onmessage handlers aren't awaited, so
  // two duplicate signaling messages arriving back-to-back can both pass
  // an `await`-based state check before either's setRemoteDescription()
  // resolves (a classic check-then-act race). These Sets are updated
  // synchronously, before any await, so the second duplicate is rejected
  // immediately regardless of how far the first one has gotten.
  const processedAnswerForCallRef = useRef<Set<string>>(new Set());
  const processedOfferForCallRef = useRef<Set<string>>(new Set());
  const idleResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopDurationTimer = useCallback(() => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
  }, []);

  const startDurationTimer = useCallback(() => {
    setDuration(0);
    durationTimerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
  }, []);

  const cleanup = useCallback(() => {
    stopDurationTimer();
    pcRef.current?.getSenders().forEach((s) => s.track?.stop());
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
    pendingOfferRef.current = null;
    pendingCandidatesRef.current = [];
    processedAnswerForCallRef.current.clear();
    processedOfferForCallRef.current.clear();
    setIsMuted(false);
  }, [stopDurationTimer]);

  const resetToIdleSoon = useCallback(() => {
    if (idleResetTimerRef.current) clearTimeout(idleResetTimerRef.current);
    idleResetTimerRef.current = setTimeout(() => {
      setPhase("idle");
      setCallId(null);
      setOtherUser(null);
      setEndedReason(null);
      callIdRef.current = null;
      otherUserIdRef.current = null;
    }, 2500); // let the "call ended" UI state show briefly before clearing
  }, []);

  async function getMic(): Promise<MediaStream> {
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      throw new Error(
        "Microphone access was denied or unavailable. Please allow microphone permission and try again."
      );
    }
  }

  function createPeerConnection(targetUserId: string, activeCallId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        send({
          type: "call_ice_candidate",
          target_user_id: targetUserId,
          call_id: activeCallId,
          candidate: e.candidate.toJSON(),
        });
      }
    };

    pc.ontrack = (e) => {
      if (!remoteAudioRef.current) {
        remoteAudioRef.current = new Audio();
        remoteAudioRef.current.autoplay = true;
      }
      remoteAudioRef.current.srcObject = e.streams[0];
    };

    return pc;
  }

  async function flushPendingCandidates(pc: RTCPeerConnection) {
    for (const candidate of pendingCandidatesRef.current) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // Ignore a candidate that fails to add (e.g. arrived after close).
      }
    }
    pendingCandidatesRef.current = [];
  }

  async function callWithRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
    let attempt = 0;
    while (true) {
      try {
        return await fn();
      } catch (err) {
        attempt++;
        if (attempt > maxRetries || (!isServerUnavailable(err) && !isTimeoutError(err) && !isNetworkError(err))) {
          throw err;
        }
        await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
      }
    }
  }

  function formatCallError(err: any): string {
    if (isNetworkError(err)) {
      return "Network disconnected. Please check your connection.";
    }
    if (isTimeoutError(err)) {
      return "Request timed out while connecting. Server may be starting up.";
    }
    if (isServerUnavailable(err)) {
      return "Server is currently waking up. Please try again in a few seconds.";
    }
    return err?.response?.data?.message || err?.message || "Couldn't complete the call.";
  }

  const startCall = useCallback(
    async (target: UserPublic) => {
      setError(null);
      setEndedReason(null);
      try {
        const call = await callWithRetry(() => callApi.initiate(target.id));
        setCallId(call.id);
        callIdRef.current = call.id;
        setOtherUser(target);
        setIsOutgoing(true);
        otherUserIdRef.current = target.id;
        setPhase("outgoing-ringing");

        const stream = await getMic();
        localStreamRef.current = stream;
        const pc = createPeerConnection(target.id, call.id);
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
        pcRef.current = pc;

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        send({ type: "call_offer", target_user_id: target.id, call_id: call.id, sdp: offer });
      } catch (err: any) {
        setPhase("idle");
        setError(formatCallError(err));
        cleanup();
      }
    },
    [send, cleanup]
  );

  const acceptCall = useCallback(async () => {
    const activeCallId = callIdRef.current;
    const targetId = otherUserIdRef.current;
    if (!activeCallId || !targetId) return;

    setPhase("connecting");
    try {
      const stream = await getMic();
      localStreamRef.current = stream;
      await callWithRetry(() => callApi.accept(activeCallId));

      const pc = createPeerConnection(targetId, activeCallId);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      pcRef.current = pc;

      if (pendingOfferRef.current) {
        await pc.setRemoteDescription(new RTCSessionDescription(pendingOfferRef.current));
        pendingOfferRef.current = null;
        processedOfferForCallRef.current.add(activeCallId);
        await flushPendingCandidates(pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        send({ type: "call_answer", target_user_id: targetId, call_id: activeCallId, sdp: answer });
      }
      // If the offer hasn't arrived yet, handleCallEvent's "call_offer"
      // case will complete the answer once it does (pc already exists).
      setPhase("ongoing");
      startDurationTimer();
    } catch (err: any) {
      setError(formatCallError(err));
      try {
        if (activeCallId) await callApi.reject(activeCallId);
      } catch {
        /* best-effort */
      }
      cleanup();
      setPhase("ended");
      resetToIdleSoon();
    }
  }, [send, cleanup, startDurationTimer, resetToIdleSoon]);

  const rejectCall = useCallback(async () => {
    const activeCallId = callIdRef.current;
    if (!activeCallId) return;
    try {
      await callApi.reject(activeCallId);
    } finally {
      cleanup();
      setPhase("idle");
      setCallId(null);
      setOtherUser(null);
      callIdRef.current = null;
      otherUserIdRef.current = null;
    }
  }, [cleanup]);

  const endCall = useCallback(async () => {
    const activeCallId = callIdRef.current;
    cleanup();
    setPhase("ended");
    setEndedReason("Call ended");
    resetToIdleSoon();
    if (activeCallId) {
      try {
        await callApi.end(activeCallId);
      } catch {
        /* best-effort — the other side or the disconnect handler will settle it server-side */
      }
    }
  }, [cleanup, resetToIdleSoon]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const nextMuted = !isMuted;
    stream.getAudioTracks().forEach((t) => (t.enabled = !nextMuted));
    setIsMuted(nextMuted);
  }, [isMuted]);

  const handleCallEvent = useCallback(
    async (event: WsEvent) => {
      switch (event.type) {
        case "incoming_call": {
          // If we're already on a call, we can't take another — the
          // backend would also reject an accept in this state, but bail
          // out client-side too so the UI doesn't show two calls.
          if (phase !== "idle") return;
          setCallId(event.call_id);
          callIdRef.current = event.call_id;
          setOtherUser({
            id: event.caller.id,
            username: event.caller.username,
            full_name: event.caller.full_name,
            avatar_url: event.caller.avatar_url,
            bio: null,
            is_online: true,
            last_seen: null,
          });
          setIsOutgoing(false);
          otherUserIdRef.current = event.caller.id;
          setPhase("incoming-ringing");
          break;
        }
        case "call_accepted": {
          if (event.call_id !== callIdRef.current) return;
          setPhase("connecting");
          break;
        }
        case "call_offer": {
          if (event.call_id !== callIdRef.current) return;
          if (pcRef.current) {
            // Synchronous dedupe FIRST (before any await) — see comment
            // on processedOfferForCallRef above for why this can't be a
            // signalingState check alone.
            if (processedOfferForCallRef.current.has(event.call_id)) return;
            if (pcRef.current.signalingState !== "stable") return;
            processedOfferForCallRef.current.add(event.call_id);
            // We already have a peer connection (accept() ran first) — answer immediately.
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(event.sdp));
            await flushPendingCandidates(pcRef.current);
            const answer = await pcRef.current.createAnswer();
            await pcRef.current.setLocalDescription(answer);
            send({ type: "call_answer", target_user_id: event.from_user_id, call_id: event.call_id, sdp: answer });
          } else {
            // Store it — acceptCall() will use it once the user clicks Accept.
            pendingOfferRef.current = event.sdp;
          }
          break;
        }
        case "call_answer": {
          if (event.call_id !== callIdRef.current || !pcRef.current) return;
          // Synchronous dedupe FIRST (before any await) — prevents the
          // "Called in wrong state: stable" crash if the same answer is
          // ever delivered twice (e.g. a momentarily duplicated socket
          // during a dev-mode double-connect). signalingState alone
          // isn't enough here because it only updates after the await
          // below resolves, leaving a race window for a second duplicate
          // message to pass the same check.
          if (processedAnswerForCallRef.current.has(event.call_id)) return;
          if (pcRef.current.signalingState !== "have-local-offer") return;
          processedAnswerForCallRef.current.add(event.call_id);
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(event.sdp));
          await flushPendingCandidates(pcRef.current);
          setPhase("ongoing");
          startDurationTimer();
          break;
        }
        case "call_ice_candidate": {
          if (event.call_id !== callIdRef.current) return;
          if (pcRef.current && pcRef.current.remoteDescription) {
            try {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(event.candidate));
            } catch {
              /* ignore */
            }
          } else {
            pendingCandidatesRef.current.push(event.candidate);
          }
          break;
        }
        case "call_rejected": {
          if (event.call_id !== callIdRef.current) return;
          cleanup();
          setPhase("ended");
          setEndedReason("Call declined");
          resetToIdleSoon();
          break;
        }
        case "call_ended": {
          if (event.call_id !== callIdRef.current) return;
          cleanup();
          setPhase("ended");
          setEndedReason(event.status === "missed" ? "Missed call" : "Call ended");
          resetToIdleSoon();
          break;
        }
      }
    },
    [phase, cleanup, send, startDurationTimer, resetToIdleSoon]
  );

  return {
    phase,
    callId,
    otherUser,
    isOutgoing,
    isMuted,
    duration,
    error,
    endedReason,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    handleCallEvent,
    clearError: () => setError(null),
  };
}
