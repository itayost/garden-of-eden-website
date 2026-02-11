"use client";

import { useSyncExternalStore, useState, useEffect, useCallback, useRef } from "react";

const HEALTH_CHECK_URL = "/api/health";
const HEALTH_CHECK_INTERVAL_MS = 30_000; // 30 seconds

export interface ConnectionStatus {
  /** Browser reports online (navigator.onLine) */
  isOnline: boolean;
  /** API is actually reachable (health check passed) */
  isReachable: boolean;
}

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getOnlineSnapshot() {
  return navigator.onLine;
}

function getServerSnapshot() {
  return true; // Assume online during SSR
}

/**
 * Tracks connection status via browser events + periodic API health check.
 */
export function useConnectionStatus(): ConnectionStatus {
  const isOnline = useSyncExternalStore(subscribeOnline, getOnlineSnapshot, getServerSnapshot);
  const [isReachable, setIsReachable] = useState(true);
  const healthCheckTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkHealth = useCallback(async () => {
    try {
      const response = await fetch(HEALTH_CHECK_URL, {
        method: "GET",
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      setIsReachable(response.ok);
    } catch {
      setIsReachable(false);
    }
  }, []);

  // When coming back online, schedule an immediate health check
  useEffect(() => {
    const timeoutId = setTimeout(
      isOnline ? checkHealth : () => setIsReachable(false),
      0
    );
    return () => clearTimeout(timeoutId);
  }, [isOnline, checkHealth]);

  // Periodic health check when browser says online
  useEffect(() => {
    if (!isOnline) {
      if (healthCheckTimer.current) {
        clearInterval(healthCheckTimer.current);
        healthCheckTimer.current = null;
      }
      return;
    }

    healthCheckTimer.current = setInterval(checkHealth, HEALTH_CHECK_INTERVAL_MS);

    return () => {
      if (healthCheckTimer.current) {
        clearInterval(healthCheckTimer.current);
        healthCheckTimer.current = null;
      }
    };
  }, [isOnline, checkHealth]);

  return { isOnline, isReachable };
}
