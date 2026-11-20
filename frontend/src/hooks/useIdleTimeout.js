import { useState, useEffect, useRef, useCallback } from 'react';
import {
  LAST_ACTIVITY_STORAGE_KEY,
  LOGOUT_EVENT_STORAGE_KEY,
  performLogout,
  sendHeartbeat
} from '../utils/api';

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const WARNING_THRESHOLD_MS = 29 * 60 * 1000; // 29 minutes (1-minute warning modal)
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes keep-alive while active
const MEMORY_THROTTLE_MS = 1000; // 1 second in-memory throttle for DOM events
const STORAGE_SYNC_THROTTLE_MS = 5000; // 5 seconds throttle for localStorage sync

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];

export default function useIdleTimeout({ enabled = false } = {}) {
  const [showWarning, setShowWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(60);
  const [stayingSignedIn, setStayingSignedIn] = useState(false);

  const lastActivityRef = useRef(Date.now());
  const lastMemoryEventRef = useRef(0);
  const lastStorageSyncRef = useRef(0);
  const lastHeartbeatAtRef = useRef(Date.now());
  const hasActivitySinceHeartbeatRef = useRef(false);
  const showWarningRef = useRef(false);
  const logoutTriggeredRef = useRef(false);

  const syncActivityToStorage = useCallback((timestamp, force = false) => {
    if (typeof window === 'undefined') return;
    if (force || timestamp - lastStorageSyncRef.current >= STORAGE_SYNC_THROTTLE_MS) {
      lastStorageSyncRef.current = timestamp;
      try {
        localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(timestamp));
      } catch (_) {}
    }
  }, []);

  const staySignedIn = useCallback(async () => {
    if (stayingSignedIn) return;
    setStayingSignedIn(true);
    try {
      const ok = await sendHeartbeat();
      if (ok) {
        const now = Date.now();
        lastActivityRef.current = now;
        lastHeartbeatAtRef.current = now;
        hasActivitySinceHeartbeatRef.current = false;
        showWarningRef.current = false;
        setShowWarning(false);
        setRemainingSeconds(60);
        syncActivityToStorage(now, true);
      }
    } finally {
      setStayingSignedIn(false);
    }
  }, [stayingSignedIn, syncActivityToStorage]);

  const logoutNow = useCallback(() => {
    logoutTriggeredRef.current = true;
    showWarningRef.current = false;
    setShowWarning(false);
    performLogout({ reason: 'manual', callApi: true, broadcast: true });
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      showWarningRef.current = false;
      setShowWarning(false);
      setRemainingSeconds(60);
      logoutTriggeredRef.current = false;
      return;
    }

    // Initialize lastActivityRef from localStorage if valid and recent, otherwise Date.now()
    const nowInit = Date.now();
    let storedTs = 0;
    try {
      storedTs = Number(localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY) || 0);
    } catch (_) {}

    if (storedTs && storedTs > 0 && nowInit - storedTs < IDLE_TIMEOUT_MS) {
      lastActivityRef.current = storedTs;
    } else if (storedTs && storedTs > 0 && nowInit - storedTs >= IDLE_TIMEOUT_MS) {
      // Already past 30 minutes of inactivity before tab even woke up
      logoutTriggeredRef.current = true;
      performLogout({ reason: 'idle', callApi: true, broadcast: true });
      return;
    } else {
      lastActivityRef.current = nowInit;
      syncActivityToStorage(nowInit, true);
    }

    lastHeartbeatAtRef.current = nowInit;
    hasActivitySinceHeartbeatRef.current = false;
    logoutTriggeredRef.current = false;

    const handleUserActivity = () => {
      // Once the 1-minute warning modal is visible, require explicit "Stay Signed In" click
      // (or activity in another tab) so a confirmed heartbeat is sent to the server.
      if (showWarningRef.current || logoutTriggeredRef.current) return;

      const now = Date.now();
      if (now - lastMemoryEventRef.current < MEMORY_THROTTLE_MS) {
        return;
      }

      lastMemoryEventRef.current = now;
      lastActivityRef.current = now;
      hasActivitySinceHeartbeatRef.current = true;
      syncActivityToStorage(now, false);
    };

    const handleStorageEvent = (event) => {
      if (event.key === LAST_ACTIVITY_STORAGE_KEY && event.newValue) {
        const remoteTs = Number(event.newValue);
        if (!Number.isNaN(remoteTs) && remoteTs > lastActivityRef.current) {
          lastActivityRef.current = remoteTs;
          lastHeartbeatAtRef.current = Math.max(lastHeartbeatAtRef.current, remoteTs);
          if (showWarningRef.current) {
            showWarningRef.current = false;
            setShowWarning(false);
            setRemainingSeconds(60);
          }
        }
      } else if (event.key === LOGOUT_EVENT_STORAGE_KEY && event.newValue) {
        let reason = 'manual';
        try {
          const parsed = JSON.parse(event.newValue);
          if (parsed?.reason) reason = parsed.reason;
        } catch (_) {}
        logoutTriggeredRef.current = true;
        showWarningRef.current = false;
        setShowWarning(false);
        performLogout({ reason, callApi: false, broadcast: false });
      } else if (event.key === 'token' && !event.newValue) {
        logoutTriggeredRef.current = true;
        showWarningRef.current = false;
        setShowWarning(false);
        performLogout({ reason: 'manual', callApi: false, broadcast: false });
      }
    };

    ACTIVITY_EVENTS.forEach((evt) => {
      window.addEventListener(evt, handleUserActivity, { passive: true });
    });
    window.addEventListener('storage', handleStorageEvent);

    const tickInterval = setInterval(() => {
      if (logoutTriggeredRef.current) return;

      // Also check localStorage in case another tab updated it
      try {
        const latestStored = Number(localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY) || 0);
        if (latestStored > lastActivityRef.current) {
          lastActivityRef.current = latestStored;
        }
      } catch (_) {}

      const now = Date.now();
      const elapsed = now - lastActivityRef.current;

      if (elapsed >= IDLE_TIMEOUT_MS) {
        logoutTriggeredRef.current = true;
        showWarningRef.current = false;
        setShowWarning(false);
        performLogout({ reason: 'idle', callApi: true, broadcast: true });
        return;
      }

      if (elapsed >= WARNING_THRESHOLD_MS) {
        const secsLeft = Math.max(0, Math.ceil((IDLE_TIMEOUT_MS - elapsed) / 1000));
        if (!showWarningRef.current) {
          showWarningRef.current = true;
          setShowWarning(true);
        }
        setRemainingSeconds(secsLeft);
        return;
      }

      if (showWarningRef.current) {
        showWarningRef.current = false;
        setShowWarning(false);
        setRemainingSeconds(60);
      }

      // Throttled Keep-Alive Heartbeat (every 5 minutes ONLY while user is actively interacting)
      if (
        hasActivitySinceHeartbeatRef.current &&
        now - lastHeartbeatAtRef.current >= HEARTBEAT_INTERVAL_MS
      ) {
        hasActivitySinceHeartbeatRef.current = false;
        lastHeartbeatAtRef.current = now;
        sendHeartbeat().catch(() => {});
      }
    }, 1000);

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => {
        window.removeEventListener(evt, handleUserActivity);
      });
      window.removeEventListener('storage', handleStorageEvent);
      clearInterval(tickInterval);
    };
  }, [enabled, syncActivityToStorage]);

  return {
    showWarning,
    remainingSeconds,
    stayingSignedIn,
    staySignedIn,
    logoutNow
  };
}
