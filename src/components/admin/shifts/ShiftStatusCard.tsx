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
  const router = useRouter();

  // Check Saturday status on mount and every minute
  useEffect(() => {
    const check = () => setIsSaturday(isSaturdayInIsrael());
    check();
    const interval = setInterval(check, 60 * 1000);
    return () => clearInterval(interval);
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

  // Check for auto-end every 5 minutes
  useEffect(() => {
    if (!activeShift) return;

    const checkInterval = setInterval(async () => {
      const result = await checkAndAutoEndShiftAction();
      if (result.autoEnded) {
        toast.warning("המשמרת הסתיימה אוטומטית אחרי 12 שעות");
        setActiveShift(null);
        router.refresh();
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(checkInterval);
  }, [activeShift, router]);

  const handleClockIn = useCallback(async () => {
    setLoading(true);
    const result = await clockInAction();
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("משמרת התחילה!");
      router.refresh();
    }
    setLoading(false);
  }, [router]);

  const handleClockOut = useCallback(async () => {
    setLoading(true);
    const result = await clockOutAction();
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("משמרת הסתיימה!");
      setActiveShift(null);
      router.refresh();
    }
    setLoading(false);
  }, [router]);

  const hoursElapsed = activeShift ? getHoursElapsed(activeShift.start_time) : 0;
  const isNear12Hours = hoursElapsed >= 11;

  return (
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
                  <Badge variant="default" className="bg-green-600">
                    במשמרת
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
                disabled={loading}
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
                disabled={loading}
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
  );
}
