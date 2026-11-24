"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ExternalLink, Loader2, Pencil, RefreshCw, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { approveRefusal } from "../../lib/approval";
import { PARENT_TARGET_WORDS, PLAYER_TARGET_WORDS } from "../../lib/guardrails";
import type { ReportDetail } from "../../lib/queries/queue";
import { queueHref, type QueueLocation } from "../../lib/queue-view";
import { reportWeekLabel } from "../../lib/report-week";
import { sentenceFacts } from "../../lib/sentence-facts";
import { ConfirmActionDialog } from "./ConfirmActionDialog";
import { FactSheetView } from "./FactSheetView";
import { HoldDialog } from "./HoldDialog";
import { GenderPicker, HoldReasons, MissedYouPreview, TextField, WordCount } from "./ReaderParts";
import { SentenceText } from "./SentenceText";
import { StatusChip } from "./StatusChip";
import { useReportActions } from "./useReportActions";

const HOLDABLE = ["pending", "approved", "held"];
type Audience = "player" | "parent";

interface ReportReaderProps {
  report: ReportDetail;
  /** The queue's place without ?report=; "אשר והבא" opens the next row in it. */
  location: QueueLocation;
  /** The row after this one in the list in view, or null after the last. */
  nextId: string | null;
  /** This report's place in the list in view, or null when it is not in it. */
  position: { index: number; total: number } | null;
}

/** True when a key press belongs to a field, a dialog's button or a shortcut of the browser. */
function isTyping(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  const field = target?.closest("input, textarea, select, [contenteditable='true'], [role='dialog']");
  return field !== null || event.metaKey || event.ctrlKey || event.altKey;
}

/**
 * One report, read sentence by sentence with its facts beside it. Read is the
 * default; ערוך opens both texts for editing. אשר והבא approves and opens the
 * next report of the list, so a morning's work never goes back to the list.
 * On a computer A approves and E edits.
 */
export function ReportReader({ report, location, nextId, position }: ReportReaderProps) {
  const router = useRouter();
  const closeHref = queueHref({ ...location, report: undefined });
  const next = () => router.replace(nextId ? queueHref({ ...location, report: nextId }) : closeHref, { scroll: false });
  const actions = useReportActions(report, next);
  const { busy, locked } = actions;

  const [editing, setEditing] = useState(false);
  const [audience, setAudience] = useState<Audience>("player");
  const [playerText, setPlayerText] = useState(report.playerText ?? "");
  const [parentText, setParentText] = useState(report.parentText ?? "");

  const isOpen = report.status === "pending" || report.status === "held";
  const written = report.kind === "report" && report.writtenAt !== null;
  const editable = written && isOpen;
  const dirty = playerText !== (report.playerText ?? "") || parentText !== (report.parentText ?? "");
  const hasTexts = playerText.trim() !== "" && parentText.trim() !== "";
  const missingGender = report.holdReasons.some((reason) => reason.code === "missing_gender");
  // The server checks again; this only keeps A and the button from asking for a refusal.
  const refusal = approveRefusal(report);
  const canApprove = !locked && isOpen && !dirty && hasTexts && report.kind === "report" && refusal === null;

  const views = useMemo(() => {
    const sheet = report.stored?.sheet;
    if (!sheet) return null;
    return {
      player: sentenceFacts(report.playerText ?? "", sheet, report.firstName),
      parent: sentenceFacts(report.parentText ?? "", sheet, report.firstName),
    };
  }, [report.stored, report.playerText, report.parentText, report.firstName]);

  async function save() {
    if (await actions.save(playerText, parentText)) setEditing(false);
  }

  function cancelEdit() {
    setPlayerText(report.playerText ?? "");
    setParentText(report.parentText ?? "");
    setEditing(false);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (isTyping(event)) return;
      if (event.code === "KeyA" && canApprove && !editing) {
        event.preventDefault();
        actions.approve();
      } else if (event.code === "KeyE" && editable && !editing) {
        event.preventDefault();
        setEditing(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actions, canApprove, editable, editing]);

  const meta = [
    report.kind === "missed_you" ? "התגעגענו" : "דוח שבועי",
    reportWeekLabel(report.weekStart),
    report.branchNames.join(", "),
  ].filter((part) => part !== "");

  const holdButton = (
    <HoldDialog variant="ghost" disabled={locked || !HOLDABLE.includes(report.status)} onHold={actions.hold} />
  );

  const actionBar =
    report.kind === "missed_you" ? (
      report.status === "pending" || report.status === "approved" ? holdButton : null
    ) : editing ? (
      <>
        <Button type="button" variant="ghost" onClick={cancelEdit} disabled={locked}>
          <X aria-hidden="true" />
          ביטול
        </Button>
        <Button type="button" onClick={save} disabled={locked || !dirty || !hasTexts} className="flex-1 lg:flex-none">
          {busy === "save" ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
          שמור שינויים
        </Button>
      </>
    ) : (
      <>
        {holdButton}
        <ConfirmActionDialog
          title="לכתוב את הדוח מחדש?"
          description="המודל יכתוב את שני הטקסטים מאותו דף עובדות. הטקסט הנוכחי, כולל עריכות, יוחלף."
          confirmLabel="כתוב מחדש"
          busyLabel="כותב..."
          onConfirm={actions.rewrite}
          trigger={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="כתוב מחדש"
              title="כתוב מחדש"
              disabled={locked || !isOpen || missingGender || report.stored === null}
            >
              <RefreshCw aria-hidden="true" />
            </Button>
          }
        />
        <Button type="button" variant="outline" onClick={() => setEditing(true)} disabled={locked || !editable}>
          <Pencil aria-hidden="true" />
          ערוך
        </Button>
        <Button
          type="button"
          onClick={actions.approve}
          disabled={!canApprove}
          title={refusal ?? undefined}
          className="flex-1 lg:flex-none"
        >
          {busy === "approve" ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
          {nextId ? "אשר והבא" : "אשר"}
          <kbd className="ms-1 hidden rounded border border-primary-foreground/40 px-1 text-[10px] font-semibold lg:inline">A</kbd>
        </Button>
      </>
    );

  return (
    <article className="flex min-h-full flex-col" aria-label={`הדוח של ${report.fullName}`}>
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-x-3 gap-y-2 border-b bg-background/95 px-4 py-3 backdrop-blur lg:px-6">
        <Link href={closeHref} replace scroll={false} className="rounded-md p-1 text-muted-foreground hover:text-foreground lg:hidden" aria-label="חזרה לרשימה">
          <ArrowRight className="size-5" aria-hidden="true" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-bold">{report.fullName}</h2>
            <StatusChip status={report.status} />
            {position && (
              <span className="text-xs tabular-nums text-muted-foreground">
                {position.index + 1} מתוך {position.total}
              </span>
            )}
          </div>
          <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
            {meta.join(" · ")}
            <span aria-hidden="true">·</span>
            <Link href={`/admin/users/${report.traineeId}`} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
              <ExternalLink className="size-3" aria-hidden="true" />
              לדף החניך
            </Link>
          </p>
          {report.parentOutcome && <p className="text-xs text-muted-foreground">{report.parentOutcome}</p>}
        </div>
        {actionBar && <div className="hidden items-center gap-2 lg:flex">{actionBar}</div>}
      </header>

      <div className="flex-1 space-y-4 px-4 py-4 lg:px-6">
        {missingGender && isOpen && <GenderPicker busy={busy} locked={locked} onPick={actions.setGender} />}
        <HoldReasons reasons={report.holdReasons} />

        {report.kind === "missed_you" ? (
          <MissedYouPreview firstName={report.firstName} />
        ) : editing ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <TextField id="player-text" label="לשחקן" value={playerText} target={PLAYER_TARGET_WORDS} onChange={setPlayerText} />
            <TextField id="parent-text" label="להורה" value={parentText} target={PARENT_TARGET_WORDS} onChange={setParentText} />
            <p className="text-xs text-muted-foreground lg:col-span-2">{"{שם}"} יוחלף בשם הפרטי. כל מספר נבדק שוב מול הנתונים בשמירה.</p>
          </div>
        ) : (
          <>
            <div role="tablist" aria-label="למי" className="flex w-max gap-1 rounded-lg bg-muted p-1 lg:hidden">
              {(["player", "parent"] as const).map((who) => (
                <button
                  key={who}
                  type="button"
                  role="tab"
                  aria-selected={audience === who}
                  onClick={() => setAudience(who)}
                  className={cn(
                    "rounded-md px-3 py-1 text-sm font-medium",
                    audience === who ? "bg-background shadow-sm" : "text-muted-foreground",
                  )}
                >
                  {who === "player" ? "לשחקן" : "להורה"}
                </button>
              ))}
            </div>
            <div className="grid gap-6 lg:grid-cols-2 lg:gap-0 lg:divide-x lg:divide-x-reverse">
              {(["player", "parent"] as const).map((who) => (
                <section key={who} className={cn("space-y-2 lg:px-4 first:lg:ps-0 last:lg:pe-0", audience !== who && "hidden lg:block")}>
                  <h3 className="flex items-baseline justify-between gap-2 text-sm font-bold text-muted-foreground">
                    {/* On a phone the tab above already names the reader. */}
                    <span className="sr-only lg:not-sr-only">{who === "player" ? "לשחקן" : "להורה"}</span>
                    <WordCount
                      text={(who === "player" ? report.playerText : report.parentText) ?? ""}
                      target={who === "player" ? PLAYER_TARGET_WORDS : PARENT_TARGET_WORDS}
                    />
                  </h3>
                  {views ? (
                    <SentenceText paragraphs={views[who]} />
                  ) : (
                    <p className="whitespace-pre-line leading-relaxed">{(who === "player" ? report.playerText : report.parentText) ?? "הטקסט עוד לא נכתב"}</p>
                  )}
                </section>
              ))}
            </div>
            {(report.editedByName || report.editRatio !== null) && (
              <p className="text-xs text-muted-foreground">
                {report.editedByName ? `נערך על ידי ${report.editedByName}` : "נערך"}
                {report.editRatio !== null ? ` (${Math.round(report.editRatio * 100)}% שינוי)` : ""}
              </p>
            )}
          </>
        )}

        {report.stored && (
          <details className="group rounded-lg border bg-muted/30">
            <summary className="cursor-pointer list-none px-4 py-2.5 text-sm font-semibold [&::-webkit-details-marker]:hidden">
              דף העובדות המלא
            </summary>
            <div className="border-t px-4 py-3">
              <FactSheetView sheet={report.stored.sheet} body={report.stored.body} />
            </div>
          </details>
        )}
      </div>

      {actionBar && (
        <footer className="sticky bottom-0 flex items-center gap-2 border-t bg-background px-4 py-3 lg:hidden">{actionBar}</footer>
      )}
    </article>
  );
}
