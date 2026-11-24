"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GENDERS, GENDER_LABELS, type Gender } from "@/lib/profile/gender";
import { cn } from "@/lib/utils";
import { isTextProblem, LENGTH_FACTOR } from "../../lib/guardrails";
import type { ReportDetail } from "../../lib/queries/queue";
import { wordCount } from "../../lib/queue-view";

const TEXT_MAX = 2000;

/** "92 / 110 מילים", amber past the target and red past what the guardrails hold. */
export function WordCount({ text, target }: { text: string; target: number }) {
  const count = wordCount(text);
  const tone =
    count > target * LENGTH_FACTOR ? "text-destructive" : count > target ? "text-warning-emphasis" : "text-muted-foreground";
  return (
    <span className={cn("text-xs tabular-nums", tone)}>
      {count} / {target} מילים
    </span>
  );
}

interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  target: number;
  onChange: (value: string) => void;
}

/** One text in edit mode, with its word count against the target. */
export function TextField({ id, label, value, target, onChange }: TextFieldProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        <WordCount text={value} target={target} />
      </div>
      <Textarea
        id={id}
        value={value}
        maxLength={TEXT_MAX}
        rows={9}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-48 leading-relaxed"
      />
    </div>
  );
}

/** Why the report stopped: what has to be fixed, or what a person has to look at. */
export function HoldReasons({ reasons }: { reasons: ReportDetail["holdReasons"] }) {
  if (reasons.length === 0) return null;
  return (
    <div role="status" className="flex gap-3 rounded-lg bg-warning/15 px-3 py-2.5 text-sm text-warning-emphasis">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 space-y-0.5">
        <p className="font-semibold">הדוח עוכב</p>
        <ul className="space-y-0.5">
          {reasons.map((reason, index) => (
            <li key={index}>{reason.text}</li>
          ))}
        </ul>
        {reasons.some(isTextProblem) && (
          <p className="pt-1 text-xs text-foreground/80">אפשר לאשר אחרי תיקון: ערוך, תקנו את הטקסט ושמרו, או כתוב מחדש.</p>
        )}
      </div>
    </div>
  );
}

/** What "התגעגענו" says: no model writes it, so it is only shown, and can be held. */
export function MissedYouPreview({ firstName }: { firstName: string }) {
  return (
    <div className="space-y-3 text-sm">
      <div className="rounded-lg border bg-card p-4">
        <p className="mb-1 text-xs text-muted-foreground">לשחקן, בדשבורד</p>
        <p className="font-semibold">התגעגענו אליך, {firstName}!</p>
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

/** בן / בת for a report held for a missing gender: the pick writes the report. */
export function GenderPicker({ busy, locked, onPick }: GenderPickerProps) {
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
