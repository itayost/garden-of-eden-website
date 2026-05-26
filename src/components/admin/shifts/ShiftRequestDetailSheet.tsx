"use client";

import { Check, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  SHIFT_REQUEST_STATUS_LABELS,
  SHIFT_REQUEST_STATUS_VARIANTS,
} from "@/components/admin/shifts/shift-request-status";
import type { ShiftChangeRequestWithPreview } from "@/lib/actions/shift-change-requests";

interface ShiftRequestDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: ShiftChangeRequestWithPreview | null;
  onApprove: () => void;
  onReject: () => void;
}

const DATE_TIME_FMT = new Intl.DateTimeFormat("he-IL", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return DATE_TIME_FMT.format(new Date(iso));
}

export function ShiftRequestDetailSheet({
  open,
  onOpenChange,
  request,
  onApprove,
  onReject,
}: ShiftRequestDetailSheetProps) {
  if (!request) return null;

  const isPending = request.status === "pending";
  const isEdit = request.request_type === "edit";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>פרטי בקשה</SheetTitle>
          <SheetDescription>
            {isEdit ? "בקשה לעדכון משמרת קיימת" : "בקשה למשמרת רטרואקטיבית"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6 px-1">
          <div className="flex items-center gap-2">
            <Badge variant={SHIFT_REQUEST_STATUS_VARIANTS[request.status]}>
              {SHIFT_REQUEST_STATUS_LABELS[request.status]}
            </Badge>
            <span className="text-sm text-muted-foreground">
              נשלחה {formatDateTime(request.created_at)}
            </span>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-2">מאמן</h3>
            <p className="text-sm">{request.trainer_name}</p>
          </div>

          {isEdit && (
            <div>
              <h3 className="text-sm font-semibold mb-2">משמרת מקורית</h3>
              <p className="text-sm">
                {formatDateTime(request.original_start_time)} →{" "}
                {formatDateTime(request.original_end_time)}
              </p>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold mb-2">
              {isEdit ? "שעות מבוקשות" : "המשמרת המבוקשת"}
            </h3>
            <p className="text-sm">
              {formatDateTime(request.requested_start_time)} →{" "}
              {formatDateTime(request.requested_end_time)}
            </p>
          </div>

          {request.merge_preview && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-medium mb-1">קיימת משמרת באותו תאריך</p>
              <p>
                למאמן יש משמרת ב-
                {formatDateTime(request.merge_preview.existing_start)} →{" "}
                {formatDateTime(request.merge_preview.existing_end)}.
              </p>
              <p className="mt-1">
                אישור הבקשה יעדכן את המשמרת הקיימת לשעות המבוקשות במקום ליצור משמרת
                חדשה.
              </p>
            </div>
          )}

          {request.reason && (
            <div>
              <h3 className="text-sm font-semibold mb-2">סיבה מהמאמן</h3>
              <p className="text-sm whitespace-pre-wrap">{request.reason}</p>
            </div>
          )}

          {!isPending && (
            <>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold mb-2">החלטה</h3>
                <p className="text-sm text-muted-foreground">
                  הוחלט {formatDateTime(request.decided_at)}
                </p>
                {request.decision_note && (
                  <p className="text-sm mt-2 whitespace-pre-wrap">
                    {request.decision_note}
                  </p>
                )}
              </div>
            </>
          )}

          {isPending && (
            <div className="flex gap-2 pt-2">
              <Button onClick={onApprove} className="flex-1">
                <Check className="h-4 w-4 me-2" />
                אשר
              </Button>
              <Button
                variant="destructive"
                onClick={onReject}
                className="flex-1"
              >
                <X className="h-4 w-4 me-2" />
                דחה
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
