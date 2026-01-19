"use client";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  UserCog,
  UserCheck,
  UserX,
  ShieldCheck,
  Edit,
  Plus,
} from "lucide-react";
import type { ActivityLog, ActivityAction } from "@/types/activity-log";
import {
  ACTIVITY_ACTION_LABELS_HE,
  FIELD_LABELS_HE,
  ROLE_LABELS_HE,
} from "@/types/activity-log";

interface ActivityLogRowProps {
  log: ActivityLog;
}

function getActionIcon(action: ActivityAction) {
  switch (action) {
    case "user_created":
      return <Plus className="h-3 w-3" />;
    case "user_activated":
      return <UserCheck className="h-3 w-3" />;
    case "user_deactivated":
      return <UserX className="h-3 w-3" />;
    case "role_changed":
      return <ShieldCheck className="h-3 w-3" />;
    default:
      return <Edit className="h-3 w-3" />;
  }
}

function getActionColor(action: ActivityAction): string {
  switch (action) {
    case "user_created":
      return "bg-green-500/10 text-green-700 dark:text-green-400";
    case "user_activated":
      return "bg-blue-500/10 text-blue-700 dark:text-blue-400";
    case "user_deactivated":
      return "bg-red-500/10 text-red-700 dark:text-red-400";
    case "role_changed":
      return "bg-purple-500/10 text-purple-700 dark:text-purple-400";
    default:
      return "bg-gray-500/10 text-gray-700 dark:text-gray-400";
  }
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "עכשיו";
  if (diffMins < 60) return `לפני ${diffMins} דקות`;
  if (diffHours < 24) return `לפני ${diffHours} שעות`;
  if (diffDays < 7) return `לפני ${diffDays} ימים`;

  return date.toLocaleDateString("he-IL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatValue(field: string, value: unknown): string {
  if (value === null || value === undefined) return "---";

  // Special formatting for certain fields
  if (field === "role" && typeof value === "string") {
    return ROLE_LABELS_HE[value] || value;
  }

  if (field === "is_active") {
    return value ? "פעיל" : "לא פעיל";
  }

  if (field === "birthdate" && typeof value === "string") {
    const date = new Date(value);
    return date.toLocaleDateString("he-IL");
  }

  return String(value);
}

export function ActivityLogRow({ log }: ActivityLogRowProps) {
  const changes = log.changes as Array<{
    field: string;
    old_value: unknown;
    new_value: unknown;
  }> | null;

  return (
    <div className="border rounded-lg p-3 space-y-2 hover:bg-muted/50 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <Badge
          variant="outline"
          className={`${getActionColor(log.action as ActivityAction)} text-xs`}
        >
          <span className="ml-1">
            {getActionIcon(log.action as ActivityAction)}
          </span>
          {ACTIVITY_ACTION_LABELS_HE[log.action as ActivityAction] ||
            log.action}
        </Badge>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {formatTimestamp(log.created_at)}
        </span>
      </div>

      {/* Actor */}
      {log.actor_name && (
        <div className="text-xs text-muted-foreground">
          על ידי: {log.actor_name}
        </div>
      )}

      {/* Changes */}
      {changes && changes.length > 0 && (
        <>
          <Separator />
          <div className="space-y-1">
            {changes.map((change, idx) => (
              <div key={idx} className="text-xs flex items-baseline gap-2">
                <span className="font-medium">
                  {FIELD_LABELS_HE[change.field] || change.field}:
                </span>
                <span className="text-muted-foreground line-through">
                  {formatValue(change.field, change.old_value)}
                </span>
                <span>←</span>
                <span className="font-medium">
                  {formatValue(change.field, change.new_value)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
