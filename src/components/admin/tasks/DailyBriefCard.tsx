"use client";

import { useState } from "react";
import { Megaphone, Pencil, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils/date";
import type { DailyBrief } from "@/types/tasks";
import { DailyBriefDialog } from "./DailyBriefDialog";

interface DailyBriefCardProps {
  /** Null when nothing was written for this date. */
  brief: DailyBrief | null;
  /** ISO YYYY-MM-DD in Israel time. */
  briefDate: string;
}

/**
 * Today's brief, at the top of the tasks page.
 *
 * Every staff member who reaches this page may write it — the page itself is
 * gated on verifyAdminOrTrainer, so there is no role check here.
 *
 * When no brief exists for today this renders an explicit empty state. It must
 * never fall back to an earlier day's brief — stale operational instructions
 * are worse than none.
 */
export function DailyBriefCard({ brief, briefDate }: DailyBriefCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Megaphone className="h-5 w-5 text-muted-foreground" />
            בריף יומי
          </CardTitle>

          <Button
            variant={brief ? "outline" : "default"}
            size="sm"
            onClick={() => setDialogOpen(true)}
          >
            {brief ? (
              <>
                <Pencil className="me-2 h-4 w-4" />
                עריכה
              </>
            ) : (
              <>
                <Plus className="me-2 h-4 w-4" />
                כתיבת בריף
              </>
            )}
          </Button>
        </CardHeader>

        <CardContent>
          {brief ? (
            <div className="space-y-3">
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {brief.content}
              </p>
              <p className="text-xs text-muted-foreground">
                {brief.author_name} · עודכן {formatDateTime(brief.updated_at)}
                {brief.updated_by_id && brief.updated_by_id !== brief.author_id
                  ? ` על ידי ${brief.updated_by_name}`
                  : ""}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              אין בריף להיום. אפשר לכתוב אחד לכל הצוות.
            </p>
          )}
        </CardContent>
      </Card>

      <DailyBriefDialog
        // Remount on date or content change so the textarea shows current data:
        // useState(prop) only runs on mount.
        key={`${briefDate}-${brief?.updated_at ?? "empty"}`}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        briefDate={briefDate}
        initialContent={brief?.content ?? ""}
      />

    </>
  );
}
