"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, PlayCircle, StopCircle, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  clockInAction,
  clockOutAction,
  checkAndAutoEndShiftAction,
} from "@/lib/actions/trainer-shifts";
import { isSaturdayInIsrael } from "@/lib/utils/israel-time";
import {
  enqueueShiftAction,
  getAllQueuedActions,
  sendBeaconSync,
  repopulateFromIDB,
  clearProcessedFromLocalStorage,
} from "@/lib/offline/shift-queue";
import { useConnectionStatus } from "@/hooks/use-connection-status";
import { useShiftQueueSync } from "@/hooks/use-shift-queue-sync";
import { ConnectionBanner } from "./ConnectionBanner";

interface ShiftStatusCardProps {
  initialShift: { id: string; start_time: string } | null;
}

function formatElapsed(startTime: string): string {
  const start = new Date(startTime);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getHoursElapsed(startTime: string): number {
  const start = new Date(startTime);
  return (Date.now() - start.getTime()) / (1000 * 60 * 60);
}

export function ShiftStatusCard({ initialShift }: ShiftStatusCardProps) {
  const [activeShift, setActiveShift] = useState(initialShift);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(
    initialShift ? formatElapsed(initialShift.start_time) : ""
  );
  const [isSaturday, setIsSaturday] = useState(false);
  const [pendingClockOut, setPendingClockOut] = useState(false);
  const router = useRouter();

  // Connection & queue sync
  const { isOnline, isReachable } = useConnectionStatus();
  const { pendingCount, isSyncing, syncQueue } = useShiftQueueSync();
  const isConnected = isOnline && isReachable;

  // Reconcile optimistic state: when queue drains, fetch real state from server
  useEffect(() => {
    const handler = () => {
      const isPendingState =
        activeShift?.id.startsWith("pending-") || pendingClockOut;
      if (isPendingState && getAllQueuedActions().length === 0) {
        setPendingClockOut(false);
        router.refresh();
      }
    };
    window.addEventListener("shift-queue-changed", handler);
    return () => window.removeEventListener("shift-queue-changed", handler);
  }, [activeShift, pendingClockOut, router]);

  // Listen for SW background sync messages
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "shift-queue-synced") {
        // Remove SW-processed items from localStorage to stay in sync
        if (event.data.processedIds?.length > 0) {
          clearProcessedFromLocalStorage(event.data.processedIds);
        }
        setPendingClockOut(false);
        router.refresh();
      } else if (event.data?.type === "shift-queue-auth-needed") {
        toast.error("נדרשת התחברות מחדש לסנכרון משמרות");
      }
    };
    navigator.serviceWorker.addEventListener("message", handleMessage);
    return () => {
      navigator.serviceWorker.removeEventListener("message", handleMessage);
    };
  }, [router]);

  // Check Saturday status on mount and every minute
  useEffect(() => {
    const check = () => setIsSaturday(isSaturdayInIsrael());
    check();
    const interval = setInterval(check, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // sendBeacon on page hide / repopulate from IDB on page show
  useEffect(() => {
    const handlePageHide = () => sendBeaconSync();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        // Last-resort sync for "tap and put phone away"
        sendBeaconSync();
      } else {
        // Page became visible — recover any items that sendBeacon cleared from
        // localStorage but the SW hasn't processed yet (still in IDB).
        repopulateFromIDB();
      }
    };
    // pagehide is more reliable than beforeunload on mobile
    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Sync local state when server data changes (after router.refresh)
  useEffect(() => {
    setActiveShift(initialShift);
  }, [initialShift]);

  // Update elapsed timer every second
  useEffect(() => {
    if (!activeShift) return;

    const interval = setInterval(() => {
      setElapsed(formatElapsed(activeShift.start_time));
    }, 1000);

    return () => clearInterval(interval);
  }, [activeShift]);

  // Check for auto-end every 5 minutes (only when connected)
  useEffect(() => {
    if (!activeShift || !isConnected) return;

    const checkInterval = setInterval(async () => {
      try {
        const result = await checkAndAutoEndShiftAction();
        if (result.autoEnded) {
          toast.warning("המשמרת הסתיימה אוטומטית אחרי 12 שעות");
          setActiveShift(null);
          router.refresh();
        }
      } catch {
        // Silently ignore — we're polling, will retry next interval
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(checkInterval);
  }, [activeShift, isConnected, router]);

  const handleClockIn = useCallback(async () => {
    setLoading(true);
    const clientTimestamp = new Date().toISOString();

    if (!isConnected) {
      // Queue for later sync
      enqueueShiftAction("clock_in", clientTimestamp);
      // Optimistic UI — show as active with the timestamp
      setActiveShift({ id: `pending-${Date.now()}`, start_time: clientTimestamp });
      toast.info("המשמרת תסונכרן כשהחיבור יחזור");
      setLoading(false);
      return;
    }

    try {
      const result = await clockInAction(clientTimestamp);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("משמרת התחילה!");
        router.refresh();
      }
    } catch {
      // Network failed mid-request — queue it
      enqueueShiftAction("clock_in", clientTimestamp);
      setActiveShift({ id: `pending-${Date.now()}`, start_time: clientTimestamp });
      toast.info("אין חיבור - המשמרת תסונכרן כשהחיבור יחזור");
    }

    setLoading(false);
  }, [isConnected, router]);

  const handleClockOut = useCallback(async () => {
    setLoading(true);
    const clientTimestamp = new Date().toISOString();

    if (!isConnected) {
      enqueueShiftAction("clock_out", clientTimestamp);
      setPendingClockOut(true);
      toast.info("סיום המשמרת יסונכרן כשהחיבור יחזור");
      setLoading(false);
      return;
    }

    try {
      const result = await clockOutAction(clientTimestamp);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("משמרת הסתיימה!");
        setActiveShift(null);
        setPendingClockOut(false);
        router.refresh();
      }
    } catch {
      // Network failed mid-request — queue it
      enqueueShiftAction("clock_out", clientTimestamp);
      setPendingClockOut(true);
      toast.info("אין חיבור - סיום המשמרת יסונכרן כשהחיבור יחזור");
    }

    setLoading(false);
  }, [isConnected, router]);

  const hoursElapsed = activeShift ? getHoursElapsed(activeShift.start_time) : 0;
  const isNear12Hours = hoursElapsed >= 11;
  const isPendingClockIn = activeShift?.id.startsWith("pending-");
  const isPending = isPendingClockIn || pendingClockOut;

  return (
    <div>
      <ConnectionBanner
        isOnline={isOnline}
        isReachable={isReachable}
        pendingCount={pendingCount}
        isSyncing={isSyncing}
        onRetry={syncQueue}
      />
      <Card className="border-2 border-dashed">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 rounded-xl p-3">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">סטטוס משמרת</h3>
                {activeShift ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="default" className={isPending ? "bg-amber-500" : "bg-green-600"}>
                      {pendingClockOut
                        ? "ממתין לסנכרון סיום"
                        : isPendingClockIn
                          ? "ממתין לסנכרון"
                          : "במשמרת"}
                    </Badge>
                    {isNear12Hours && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        קרוב ל-12 שעות
                      </Badge>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">לא במשמרת</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              {activeShift && (
                <div className="text-end">
                  <p className="text-3xl font-mono font-bold tabular-nums">
                    {elapsed}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    התחלה:{" "}
                    {new Date(activeShift.start_time).toLocaleTimeString("he-IL", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              )}

              {activeShift ? (
                <Button
                  onClick={handleClockOut}
                  disabled={loading || isSyncing || pendingClockOut}
                  variant="destructive"
                  size="lg"
                  className="min-w-[140px]"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                  ) : (
                    <StopCircle className="h-4 w-4 ml-2" />
                  )}
                  סיים משמרת
                </Button>
              ) : isSaturday ? (
                <div className="text-center">
                  <Button disabled size="lg" className="min-w-[140px]" variant="secondary">
                    <PlayCircle className="h-4 w-4 ml-2" />
                    התחל משמרת
                  </Button>
                  <p className="text-sm text-muted-foreground mt-2">
                    לא ניתן להתחיל משמרת בשבת
                  </p>
                </div>
              ) : (
                <Button
                  onClick={handleClockIn}
                  disabled={loading || isSyncing}
                  size="lg"
                  className="min-w-[140px]"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                  ) : (
                    <PlayCircle className="h-4 w-4 ml-2" />
                  )}
                  התחל משמרת
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
