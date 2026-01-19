import { createClient } from "@/lib/supabase/server";
import { ActivityLogRow } from "./ActivityLogRow";
import { History, AlertCircle } from "lucide-react";
import type { ActivityLog } from "@/types/activity-log";

interface ActivityLogTableProps {
  userId: string;
  limit?: number;
}

export async function ActivityLogTable({
  userId,
  limit = 20,
}: ActivityLogTableProps) {
  const supabase = await createClient();

  const { data: logs, error } = await supabase
    .from("activity_logs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Failed to fetch activity logs:", error);
    return (
      <div className="text-center py-8 text-destructive">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-sm">שגיאה בטעינת היסטוריית הפעילות</p>
      </div>
    );
  }

  const typedLogs = logs as ActivityLog[] | null;

  if (!typedLogs || typedLogs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-sm">אין פעילות רשומה עדיין</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-[600px] overflow-y-auto">
      {typedLogs.map((log) => (
        <ActivityLogRow key={log.id} log={log} />
      ))}
    </div>
  );
}
