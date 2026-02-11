"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import {
  resolveFailedSyncAction,
  type FailedShiftSync,
} from "@/lib/actions/trainer-shifts";

interface FailedSyncsBannerProps {
  failedSyncs: FailedShiftSync[];
}

function formatTimestamp(timestamp: string): string {
  try {
    return new Date(timestamp).toLocaleString("he-IL", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return timestamp;
  }
}

export function FailedSyncsBanner({ failedSyncs }: FailedSyncsBannerProps) {
  const [resolving, setResolving] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const router = useRouter();

  if (failedSyncs.length === 0 || dismissed) return null;

  const handleResolve = async (id: string) => {
    setResolving(id);
    const result = await resolveFailedSyncAction(id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("סומן כטופל");
      router.refresh();
    }
    setResolving(null);
  };

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-red-800">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <h3 className="font-semibold">
            {failedSyncs.length === 1
              ? "פעולת משמרת אחת לא סונכרנה"
              : `${failedSyncs.length} פעולות משמרת לא סונכרנו`}
          </h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
          onClick={() => setDismissed(true)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <p className="text-sm text-red-700">
        פעולות אלו פגו (עברו יותר משעתיים מרגע הלחיצה של המאמן). יש לעדכן
        ידנית את המשמרות הרלוונטיות.
      </p>

      <div className="space-y-2">
        {failedSyncs.map((sync) => (
          <div
            key={sync.id}
            className="flex items-center justify-between gap-3 rounded-md bg-white/60 px-3 py-2 text-sm"
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="font-medium truncate">{sync.trainer_name}</span>
              <Badge variant="outline" className="text-xs shrink-0">
                {sync.action_type === "clock_in" ? "כניסה" : "יציאה"}
              </Badge>
              <span className="text-muted-foreground text-xs shrink-0">
                {formatTimestamp(sync.client_timestamp)}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs shrink-0"
              onClick={() => handleResolve(sync.id)}
              disabled={resolving === sync.id}
            >
              {resolving === sync.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <CheckCircle className="h-3 w-3" />
              )}
              טופל
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
