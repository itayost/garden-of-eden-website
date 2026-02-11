"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  getAllQueuedActions,
  dequeueShiftAction,
  isActionExpired,
  clearExpiredActions,
  incrementRetryCount,
  type QueuedShiftAction,
} from "@/lib/offline/shift-queue";
import {
  clockInAction,
  clockOutAction,
} from "@/lib/actions/trainer-shifts";
import { useConnectionStatus } from "./use-connection-status";

const MAX_RETRIES = 3;
const SYNC_POLL_INTERVAL_MS = 10_000; // Check queue every 10s when online

export interface ShiftQueueSyncState {
  pendingCount: number;
  isSyncing: boolean;
  syncQueue: () => Promise<void>;
}

/**
 * Manages syncing queued shift actions with the server.
 * Automatically retries with exponential backoff when online.
 */
export function useShiftQueueSync(): ShiftQueueSyncState {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const isSyncingRef = useRef(false);
  const router = useRouter();
  const { isOnline, isReachable } = useConnectionStatus();

  // Refresh pending count from localStorage
  const refreshCount = useCallback(() => {
    const actions = getAllQueuedActions();
    setPendingCount(actions.length);
  }, []);

  // Listen for queue changes (from enqueue/dequeue in other parts of the app)
  useEffect(() => {
    refreshCount();
    const handler = () => refreshCount();
    window.addEventListener("shift-queue-changed", handler);
    return () => window.removeEventListener("shift-queue-changed", handler);
  }, [refreshCount]);

  // Process a single action — returns true on success
  const processAction = useCallback(
    async (action: QueuedShiftAction): Promise<boolean> => {
      if (isActionExpired(action)) {
        dequeueShiftAction(action.id);
        toast.error("פעולת משמרת פגה ולא סונכרנה (עברו יותר משעתיים)");
        return true; // Removed from queue, considered "handled"
      }

      try {
        const result =
          action.type === "clock_in"
            ? await clockInAction(action.clientTimestamp)
            : await clockOutAction(action.clientTimestamp);

        if (result.error) {
          // Server rejected — don't retry, remove from queue
          console.error(`[shift-sync] Server rejected ${action.type}:`, result.error);
          dequeueShiftAction(action.id);
          toast.error(result.error);
          return true;
        }

        // Success
        dequeueShiftAction(action.id);
        return true;
      } catch {
        // Network error — retry later
        incrementRetryCount(action.id);
        return false;
      }
    },
    []
  );

  // Process the entire queue
  const syncQueue = useCallback(async () => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    setIsSyncing(true);

    try {
      // Clean up expired actions first
      const expired = clearExpiredActions();
      if (expired.length > 0) {
        toast.error(
          `${expired.length} ${expired.length === 1 ? "פעולה פגה" : "פעולות פגו"} ולא סונכרנו`
        );
      }

      const actions = getAllQueuedActions();
      if (actions.length === 0) {
        refreshCount();
        return;
      }

      let syncedCount = 0;
      let failedCount = 0;

      // Process actions in order (clock_in before clock_out)
      const sorted = [...actions].sort((a, b) => a.queuedAt - b.queuedAt);

      for (const action of sorted) {
        if (action.retryCount >= MAX_RETRIES) {
          dequeueShiftAction(action.id);
          toast.error("כשל בסנכרון משמרת אחרי מספר ניסיונות");
          continue;
        }

        const success = await processAction(action);
        if (success) {
          syncedCount++;
        } else {
          failedCount++;
          // Don't block the UI thread with exponential backoff.
          // Stop processing — the polling interval will retry remaining actions.
          break;
        }
      }

      if (syncedCount > 0 && failedCount === 0) {
        toast.success("פעולות משמרת סונכרנו בהצלחה");
        router.refresh();
      }

      refreshCount();
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, [processAction, refreshCount, router]);

  // Auto-sync when connection is restored or on a periodic interval
  useEffect(() => {
    if (!isOnline || !isReachable) return;

    // Immediate sync when back online
    if (pendingCount > 0) {
      syncQueue();
    }

    // Periodic polling while online with pending actions
    const interval = setInterval(() => {
      const current = getAllQueuedActions();
      if (current.length > 0 && !isSyncingRef.current) {
        syncQueue();
      }
    }, SYNC_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isOnline, isReachable, pendingCount, syncQueue]);

  // Sync on tab focus (visibility change)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        const current = getAllQueuedActions();
        if (current.length > 0 && !isSyncingRef.current) {
          syncQueue();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [syncQueue]);

  return { pendingCount, isSyncing, syncQueue };
}
