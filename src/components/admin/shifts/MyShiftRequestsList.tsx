"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cancelShiftChangeRequestAction } from "@/lib/actions/shift-change-requests";
import { RetroShiftRequestDialog } from "@/components/admin/shifts/RetroShiftRequestDialog";
import {
  SHIFT_REQUEST_STATUS_LABELS,
  SHIFT_REQUEST_STATUS_VARIANTS,
} from "@/components/admin/shifts/shift-request-status";
import type { ShiftChangeRequest } from "@/types/database";

interface MyShiftRequestsListProps {
  requests: ShiftChangeRequest[];
}

const DATE_FMT = new Intl.DateTimeFormat("he-IL", {
  day: "numeric",
  month: "short",
  weekday: "short",
});
const TIME_FMT = new Intl.DateTimeFormat("he-IL", {
  hour: "2-digit",
  minute: "2-digit",
});

function formatDate(iso: string): string {
  return DATE_FMT.format(new Date(iso));
}

function formatTime(iso: string): string {
  return TIME_FMT.format(new Date(iso));
}

export function MyShiftRequestsList({ requests }: MyShiftRequestsListProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(true);
  const [showRetroDialog, setShowRetroDialog] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  const handleCancel = async (id: string) => {
    setCancellingId(id);
    const result = await cancelShiftChangeRequestAction(id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("הבקשה בוטלה");
      router.refresh();
    }
    setCancellingId(null);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <button
              type="button"
              className="flex items-center gap-2 text-start"
              onClick={() => setExpanded(!expanded)}
            >
              <CardTitle className="text-lg">הבקשות שלי</CardTitle>
              {pendingCount > 0 && (
                <Badge variant="secondary">{pendingCount} ממתינות</Badge>
              )}
              {expanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            <Button size="sm" onClick={() => setShowRetroDialog(true)}>
              <Plus className="h-4 w-4 me-1" />
              בקשה למשמרת רטרואקטיבית
            </Button>
          </div>
        </CardHeader>

        {expanded && (
          <CardContent>
            {requests.length === 0 ? (
              <p className="text-sm text-muted-foreground">לא נשלחו בקשות עד כה</p>
            ) : (
              <div className="space-y-2">
                {requests.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-lg border p-3 flex flex-wrap items-start justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={SHIFT_REQUEST_STATUS_VARIANTS[r.status]}>
                          {SHIFT_REQUEST_STATUS_LABELS[r.status]}
                        </Badge>
                        <span className="text-sm font-medium">
                          {r.request_type === "retro_add"
                            ? "הוספת משמרת"
                            : "עריכת משמרת"}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {formatDate(r.requested_start_time)} ·{" "}
                          {formatTime(r.requested_start_time)}–
                          {formatTime(r.requested_end_time)}
                        </span>
                      </div>
                      {r.reason && (
                        <p className="text-xs text-muted-foreground">
                          סיבה: {r.reason}
                        </p>
                      )}
                      {r.decision_note && (
                        <p className="text-xs text-muted-foreground">
                          הערת מנהל: {r.decision_note}
                        </p>
                      )}
                    </div>
                    {r.status === "pending" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCancel(r.id)}
                        disabled={cancellingId === r.id}
                      >
                        {cancellingId === r.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          "בטל בקשה"
                        )}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      <RetroShiftRequestDialog
        open={showRetroDialog}
        onOpenChange={setShowRetroDialog}
      />
    </>
  );
}
