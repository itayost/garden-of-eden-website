"use client";

import { Info } from "lucide-react";

import { answeredText } from "../../lib/format";
import { DateField } from "./DateField";
import { SurveyDetailsFields } from "./SurveyDetailsFields";
import type { LockedValues } from "./useLockedDetails";

const REOPEN_HINT = "סקר שנסגר לפי תאריך נפתח שוב עד התאריך החדש.";

interface LockedDetailsPanelProps {
  /** At least one: the Survey is locked because someone answered. */
  responseCount: number;
  values: LockedValues;
  /** The new close date opens a Survey that ended by date. */
  reopens: boolean;
  onEdit: (patch: Partial<LockedValues>) => void;
}

/** Why the rest is locked, and the three fields that are not. */
export function LockedDetailsPanel({ responseCount, values, reopens, onEdit }: LockedDetailsPanelProps) {
  return (
    <section
      aria-label="פרטי הסקר"
      className="flex flex-col gap-3.5 rounded-xl border bg-card px-4 py-4 shadow-sm lg:sticky lg:top-4 lg:px-[18px]"
    >
      <div className="flex gap-2.5 rounded-lg bg-info/10 p-3 text-[13px] leading-relaxed">
        <Info aria-hidden="true" className="mt-0.5 size-4 flex-none text-info" />
        <p>
          <strong>{answeredText(responseCount)}.</strong> השאלות והקהל נעולים כדי שהתוצאות יישארו השוואתיות.
          אפשר לשנות כותרת, פתיח ותאריך סגירה.
        </p>
      </div>
      <SurveyDetailsFields
        idPrefix="locked"
        title={values.title}
        intro={values.intro}
        onTitleChange={(title) => onEdit({ title })}
        onIntroChange={(intro) => onEdit({ intro })}
      />
      <DateField
        id="locked-closes-on"
        label="נסגר"
        optional
        value={values.closesOn}
        hint={reopens ? REOPEN_HINT : undefined}
        onChange={(closesOn) => onEdit({ closesOn })}
      />
    </section>
  );
}
