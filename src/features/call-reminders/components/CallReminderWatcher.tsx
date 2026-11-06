"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, PhoneMissed } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LeadContactLogForm } from "@/components/admin/leads/LeadContactLogForm";
import { formatRelativeTime } from "@/lib/utils/date";
import { cn } from "@/lib/utils";
import { CALL_REMINDER_POLL_MS, targetKey, type DueReminder } from "../lib/rules";
import {
  dismissCallReminderAction,
  getCallRemindersAction,
} from "../lib/actions/call-attempts";
import { CALL_EVENTS } from "../lib/events";
import { RetentionCallDialog } from "./RetentionCallDialog";

/** Wait a beat past the due time so the server agrees it is due. */
const DUE_TIMER_SLACK_MS = 1000;

const KIND_LABEL = { lead: "ליד", retention: "שימור לקוחות" } as const;

/**
 * Shows the signed-in staff member the calls they tapped 10 or more minutes
 * ago and have not documented. Mounted once in the admin layout. It asks the
 * server on load, every minute while the tab is visible, when the tab comes
 * back into view (from the dialer), when a call starts or is documented on the
 * page, and at the next due time. No push: a closed browser sees it next time.
 */
export function CallReminderWatcher() {
  const [reminders, setReminders] = useState<readonly DueReminder[]>([]);
  const [nextDueAt, setNextDueAt] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [documenting, setDocumenting] = useState<DueReminder | null>(null);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const latestRequest = useRef(0);

  const refresh = useCallback(async () => {
    const request = ++latestRequest.current;
    try {
      const result = await getCallRemindersAction();
      if (request !== latestRequest.current) return;
      if ("error" in result) {
        console.error("[calls] reminder refresh failed:", result.error);
        return;
      }
      setReminders(result.data.due);
      setNextDueAt(result.data.nextDueAt);
    } catch (err) {
      console.error("[calls] reminder refresh failed:", err);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const refreshNow = () => void refresh();
    const interval = window.setInterval(refreshIfVisible, CALL_REMINDER_POLL_MS);
    document.addEventListener("visibilitychange", refreshIfVisible);
    window.addEventListener("focus", refreshNow);
    window.addEventListener(CALL_EVENTS.started, refreshNow);
    window.addEventListener(CALL_EVENTS.documented, refreshNow);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshIfVisible);
      window.removeEventListener("focus", refreshNow);
      window.removeEventListener(CALL_EVENTS.started, refreshNow);
      window.removeEventListener(CALL_EVENTS.documented, refreshNow);
    };
  }, [refresh]);

  useEffect(() => {
    if (!nextDueAt) return;
    const delay = Math.max(0, Date.parse(nextDueAt) - Date.now()) + DUE_TIMER_SLACK_MS;
    const timer = window.setTimeout(() => void refresh(), delay);
    return () => window.clearTimeout(timer);
  }, [nextDueAt, refresh]);

  const dismiss = async (reminder: DueReminder) => {
    setDismissingId(reminder.attemptId);
    try {
      const result = await dismissCallReminderAction(reminder.attemptId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      const key = targetKey(reminder.target);
      setReminders((prev) => prev.filter((r) => targetKey(r.target) !== key));
    } catch {
      toast.error("שגיאה בסגירת התזכורת");
    } finally {
      setDismissingId(null);
    }
  };

  const closeDocumenting = () => setDocumenting(null);

  return (
    <>
      {reminders.length > 0 && (
        <section
          role="status"
          aria-label="תזכורות לתיעוד שיחות"
          className={cn(
            "fixed inset-x-4 bottom-[max(env(safe-area-inset-bottom),1rem)] z-50",
            "sm:inset-x-auto sm:end-4 sm:w-96",
            "overflow-hidden rounded-xl border border-amber-500/40 bg-background shadow-xl",
          )}
        >
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-expanded={!collapsed}
            className="flex w-full items-center gap-2 bg-amber-500/10 px-4 py-3 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <PhoneMissed className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
            <span className="flex-1 text-sm font-semibold">
              {reminders.length === 1 ? "שיחה שלא תועדה" : `${reminders.length} שיחות שלא תועדו`}
            </span>
            <ChevronDown
              className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")}
              aria-hidden
            />
          </button>

          {!collapsed && (
            <ul className="max-h-[50vh] divide-y overflow-y-auto">
              {reminders.map((reminder) => (
                <li key={reminder.attemptId} className="space-y-2 px-4 py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-medium">{reminder.contactName}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {KIND_LABEL[reminder.target.kind]} · {formatRelativeTime(reminder.startedAt)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">לא תיעדת את השיחה</p>
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1" onClick={() => setDocumenting(reminder)}>
                      תיעוד
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-1"
                      disabled={dismissingId === reminder.attemptId}
                      onClick={() => void dismiss(reminder)}
                    >
                      לא התקיימה שיחה
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {documenting?.target.kind === "lead" && (
        <Dialog open onOpenChange={(open) => !open && closeDocumenting()}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>תיעוד שיחה</DialogTitle>
              <DialogDescription>{documenting.contactName}</DialogDescription>
            </DialogHeader>
            <LeadContactLogForm
              leadId={documenting.target.leadId}
              defaultContactType="call"
              onSuccess={closeDocumenting}
            />
          </DialogContent>
        </Dialog>
      )}

      {documenting?.target.kind === "retention" && (
        <RetentionCallDialog
          open
          onOpenChange={(open) => !open && closeDocumenting()}
          reportMonth={documenting.target.reportMonth}
          phone={documenting.target.phone}
          traineeName={documenting.contactName}
        />
      )}
    </>
  );
}
