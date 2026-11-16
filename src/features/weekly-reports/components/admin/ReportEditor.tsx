"use client";

import { useState } from "react";
import { Check, Loader2, RefreshCw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GENDERS, GENDER_LABELS, type Gender } from "@/lib/profile/gender";
import { cn } from "@/lib/utils";
import { LENGTH_FACTOR, PARENT_TARGET_WORDS, PLAYER_TARGET_WORDS } from "../../lib/guardrails";
import type { ReportDetail } from "../../lib/queries/queue";
import { wordCount } from "../../lib/queue-view";
import { ConfirmActionDialog } from "./ConfirmActionDialog";
import { HoldDialog } from "./HoldDialog";
import { useReportActions } from "./useReportActions";

const TEXT_MAX = 2000;
const HOLDABLE = ["pending", "approved", "held"];

interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  target: number;
  readOnly: boolean;
  onChange: (value: string) => void;
}

/** One text with its word count against the target; red past the length the guardrails hold. */
function TextField({ id, label, value, target, readOnly, onChange }: TextFieldProps) {
  const count = wordCount(value);
  const tone =
    count > target * LENGTH_FACTOR ? "text-destructive" : count > target ? "text-warning-emphasis" : "text-muted-foreground";
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        <span className={cn("text-xs tabular-nums", tone)}>
          {count} / {target} מילים
        </span>
      </div>
      <Textarea
        id={id}
        value={value}
        readOnly={readOnly}
        maxLength={TEXT_MAX}
        rows={8}
        placeholder={readOnly && value === "" ? "הטקסט עוד לא נכתב" : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={cn("min-h-40 leading-relaxed", readOnly && "bg-muted/40")}
      />
    </div>
  );
}

function HoldReasons({ reasons }: { reasons: ReportDetail["holdReasons"] }) {
  if (reasons.length === 0) return null;
  return (
    <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
      <p className="mb-1 font-medium text-warning-emphasis">סיבות העיכוב</p>
      <ul className="list-disc space-y-0.5 ps-5">
        {reasons.map((reason, index) => (
          <li key={index}>{reason.text}</li>
        ))}
      </ul>
    </div>
  );
}

/** What "התגעגענו" says: no model writes it, so it is shown and can only be held. */
function MissedYouPreview({ firstName }: { firstName: string }) {
  return (
    <div className="space-y-3 text-sm">
      <div className="rounded-lg border p-3">
        <p className="mb-1 text-xs text-muted-foreground">לשחקן, בדשבורד</p>
        <p className="font-medium">התגעגענו אליך, {firstName}!</p>
        <p>מחכים לראות אותך באימון הבא</p>
      </div>
      <p className="text-muted-foreground">להורה נשלחת הודעת וואטסאפ קבועה עם השם הפרטי של {firstName}.</p>
    </div>
  );
}

interface GenderPickerProps {
  busy: string | null;
  locked: boolean;
  onPick: (gender: Gender) => void;
}

/** בן / בת for a report held for missing gender: the pick writes the report. */
function GenderPicker({ busy, locked, onPick }: GenderPickerProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
      <span className="font-medium">חסר מגדר. בחרו כדי שהדוח ייכתב:</span>
      {GENDERS.map((gender) => (
        <Button key={gender} type="button" size="sm" variant="outline" disabled={locked} onClick={() => onPick(gender)}>
          {busy === `gender-${gender}` && <Loader2 className="animate-spin" aria-hidden="true" />}
          {GENDER_LABELS[gender]}
        </Button>
      ))}
    </div>
  );
}

interface ReportEditorProps {
  report: ReportDetail;
  /** Closes the sheet: after an approval the next row is the work. */
  onDone: () => void;
}

/** The sheet's form: the two texts, the Holds and every action on the report. */
export function ReportEditor({ report, onDone }: ReportEditorProps) {
  const [playerText, setPlayerText] = useState(report.playerText ?? "");
  const [parentText, setParentText] = useState(report.parentText ?? "");
  const actions = useReportActions(report, onDone);
  const { busy, locked } = actions;

  const isOpen = report.status === "pending" || report.status === "held";
  const editable = report.kind === "report" && isOpen && report.writtenAt !== null;
  const dirty = playerText !== (report.playerText ?? "") || parentText !== (report.parentText ?? "");
  const hasTexts = playerText.trim() !== "" && parentText.trim() !== "";
  const missingGender = report.holdReasons.some((reason) => reason.code === "missing_gender");
  const holdButton = <HoldDialog disabled={locked || !HOLDABLE.includes(report.status)} onHold={actions.hold} />;

  if (report.kind === "missed_you") {
    return (
      <div className="space-y-4">
        <HoldReasons reasons={report.holdReasons} />
        <MissedYouPreview firstName={report.firstName} />
        {report.status === "pending" || report.status === "approved" ? <div>{holdButton}</div> : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {missingGender && isOpen && <GenderPicker busy={busy} locked={locked} onPick={actions.setGender} />}
      <HoldReasons reasons={report.holdReasons} />
      <TextField id="player-text" label="לשחקן" value={playerText} target={PLAYER_TARGET_WORDS} readOnly={!editable} onChange={setPlayerText} />
      <TextField id="parent-text" label="להורה" value={parentText} target={PARENT_TARGET_WORDS} readOnly={!editable} onChange={setParentText} />
      <p className="text-xs text-muted-foreground">
        {"{שם}"} יוחלף בשם הפרטי
        {report.editedByName ? ` · נערך על ידי ${report.editedByName}` : ""}
        {report.editRatio !== null ? ` (${Math.round(report.editRatio * 100)}% שינוי)` : ""}
      </p>
      {dirty && <p className="text-xs text-warning-emphasis">יש שינויים שלא נשמרו. שמרו לפני האישור.</p>}

      <div className="sticky bottom-0 flex flex-wrap gap-2 border-t bg-background py-3">
        <Button type="button" onClick={actions.approve} disabled={locked || !isOpen || dirty || !hasTexts}>
          {busy === "approve" ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
          אשר
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => actions.save(playerText, parentText)}
          disabled={locked || !editable || !dirty || !hasTexts}
        >
          {busy === "save" ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
          שמור שינויים
        </Button>
        {holdButton}
        <ConfirmActionDialog
          title="לכתוב את הדוח מחדש?"
          description="המודל יכתוב את שני הטקסטים מאותו דף עובדות. הטקסט הנוכחי, כולל עריכות, יוחלף."
          confirmLabel="כתוב מחדש"
          busyLabel="כותב..."
          onConfirm={actions.rewrite}
          trigger={
            <Button type="button" variant="ghost" disabled={locked || !isOpen || missingGender || report.stored === null}>
              <RefreshCw aria-hidden="true" />
              כתוב מחדש
            </Button>
          }
        />
      </div>
    </div>
  );
}
