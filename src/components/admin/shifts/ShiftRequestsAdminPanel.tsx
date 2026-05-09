"use client";

import { useMemo, useState } from "react";
import { Check, X, Inbox } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApproveRequestDialog } from "@/components/admin/shifts/ApproveRequestDialog";
import { RejectRequestDialog } from "@/components/admin/shifts/RejectRequestDialog";
import { ShiftRequestDetailSheet } from "@/components/admin/shifts/ShiftRequestDetailSheet";
import {
  SHIFT_REQUEST_STATUS_LABELS,
  SHIFT_REQUEST_STATUS_VARIANTS,
  SHIFT_REQUEST_TYPE_LABELS,
} from "@/components/admin/shifts/shift-request-status";
import { formatRequestSummary } from "@/lib/validations/shift-change-requests";
import type { ShiftChangeRequestWithPreview } from "@/lib/actions/shift-change-requests";
import type { ShiftChangeRequestStatus } from "@/types/database";

interface ShiftRequestsAdminPanelProps {
  requests: ShiftChangeRequestWithPreview[];
}

type FilterValue = ShiftChangeRequestStatus | "all";

const FILTERS: { value: FilterValue; label: string; tone: string }[] = [
  { value: "pending", label: "ממתינות", tone: "bg-amber-500" },
  { value: "approved", label: "אושרו", tone: "bg-green-500" },
  { value: "rejected", label: "נדחו", tone: "bg-red-500" },
  { value: "cancelled", label: "בוטלו", tone: "bg-gray-500" },
];

const DATE_FMT = new Intl.DateTimeFormat("he-IL", {
  day: "numeric",
  month: "short",
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

function buildMergeNotice(r: ShiftChangeRequestWithPreview): string | null {
  if (!r.merge_preview) return null;
  return `למאמן כבר יש משמרת בתאריך זה (${formatTime(
    r.merge_preview.existing_start
  )}–${
    r.merge_preview.existing_end ? formatTime(r.merge_preview.existing_end) : "—"
  }). אישור יעדכן את המשמרת הקיימת לשעות המבוקשות.`;
}

export function ShiftRequestsAdminPanel({
  requests,
}: ShiftRequestsAdminPanelProps) {
  const [filter, setFilter] = useState<FilterValue>("pending");
  const [selected, setSelected] = useState<ShiftChangeRequestWithPreview | null>(
    null
  );
  const [showApprove, setShowApprove] = useState(false);
  const [showReject, setShowReject] = useState(false);

  const detailOpen = selected !== null && !showApprove && !showReject;

  const counts = useMemo(() => {
    const c: Record<FilterValue, number> = {
      pending: 0,
      approved: 0,
      rejected: 0,
      cancelled: 0,
      all: requests.length,
    };
    requests.forEach((r) => {
      c[r.status] += 1;
    });
    return c;
  }, [requests]);

  const filtered = useMemo(() => {
    if (filter === "all") return requests;
    return requests.filter((r) => r.status === filter);
  }, [requests, filter]);

  const openDetail = (request: ShiftChangeRequestWithPreview) => {
    setSelected(request);
  };

  const openApprove = (request: ShiftChangeRequestWithPreview) => {
    setSelected(request);
    setShowApprove(true);
  };

  const openReject = (request: ShiftChangeRequestWithPreview) => {
    setSelected(request);
    setShowReject(true);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {FILTERS.map((f) => {
          const isActive = filter === f.value;
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`text-start transition ${isActive ? "ring-2 ring-primary" : ""}`}
            >
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className={`${f.tone} rounded-xl p-3`}>
                      <Inbox className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{f.label}</p>
                      <p className="text-2xl font-bold">{counts[f.value]}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            אין בקשות בקטגוריה זו
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">מאמן</TableHead>
                    <TableHead className="text-right">סוג</TableHead>
                    <TableHead className="text-right">תאריך מבוקש</TableHead>
                    <TableHead className="text-right">שעות</TableHead>
                    <TableHead className="text-right">סטטוס</TableHead>
                    <TableHead className="text-right">נשלחה</TableHead>
                    <TableHead className="text-right w-[140px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => openDetail(r)}
                    >
                      <TableCell className="font-medium">
                        {r.trainer_name}
                      </TableCell>
                      <TableCell>{SHIFT_REQUEST_TYPE_LABELS[r.request_type]}</TableCell>
                      <TableCell>{formatDate(r.requested_start_time)}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatTime(r.requested_start_time)}–
                        {formatTime(r.requested_end_time)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={SHIFT_REQUEST_STATUS_VARIANTS[r.status]}>
                          {SHIFT_REQUEST_STATUS_LABELS[r.status]}
                        </Badge>
                        {r.merge_preview && (
                          <Badge variant="outline" className="ms-1">
                            מיזוג
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(r.created_at)}
                      </TableCell>
                      <TableCell>
                        {r.status === "pending" && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                openApprove(r);
                              }}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                openReject(r);
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-2 sm:hidden">
              {filtered.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => openDetail(r)}
                  className="w-full rounded-lg border p-3 text-start"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm">{r.trainer_name}</span>
                    <Badge variant={SHIFT_REQUEST_STATUS_VARIANTS[r.status]}>
                      {SHIFT_REQUEST_STATUS_LABELS[r.status]}
                    </Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {SHIFT_REQUEST_TYPE_LABELS[r.request_type]} ·{" "}
                    {formatDate(r.requested_start_time)} ·{" "}
                    {formatTime(r.requested_start_time)}–
                    {formatTime(r.requested_end_time)}
                  </div>
                  {r.merge_preview && (
                    <Badge variant="outline" className="mt-1">
                      מיזוג למשמרת קיימת
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <ShiftRequestDetailSheet
        open={detailOpen}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        request={selected}
        onApprove={() => {
          if (selected) openApprove(selected);
        }}
        onReject={() => {
          if (selected) openReject(selected);
        }}
      />

      {selected && (
        <>
          <ApproveRequestDialog
            open={showApprove}
            onOpenChange={(open) => {
              setShowApprove(open);
              if (!open) setSelected(null);
            }}
            requestId={selected.id}
            summary={formatRequestSummary(selected)}
            mergeNotice={buildMergeNotice(selected)}
          />
          <RejectRequestDialog
            open={showReject}
            onOpenChange={(open) => {
              setShowReject(open);
              if (!open) setSelected(null);
            }}
            requestId={selected.id}
            summary={formatRequestSummary(selected)}
          />
        </>
      )}
    </div>
  );
}
