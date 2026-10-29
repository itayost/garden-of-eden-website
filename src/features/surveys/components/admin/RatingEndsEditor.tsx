"use client";

import { Input } from "@/components/ui/input";
import { SURVEY_LIMITS } from "../../lib/types";

const CELLS = [1, 2, 3, 4, 5] as const;

interface RatingEndsEditorProps {
  questionNumber: number;
  lowLabel: string | null;
  highLabel: string | null;
  onChange: (labels: { lowLabel: string | null; highLabel: string | null }) => void;
}

/** A blank label means no label. */
const orNull = (value: string): string | null => (value === "" ? null : value);

/** The two end labels of a rating, either side of the 1 to 5 scale the Trainee will see. */
export function RatingEndsEditor({ questionNumber, lowLabel, highLabel, onChange }: RatingEndsEditorProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <Input
        value={lowLabel ?? ""}
        maxLength={SURVEY_LIMITS.labelMax}
        placeholder="בכלל לא"
        aria-label={`תווית לדירוג 1 בשאלה ${questionNumber}`}
        className="h-8 w-36"
        onChange={(event) => onChange({ lowLabel: orNull(event.target.value), highLabel })}
      />
      <div aria-hidden="true" className="flex gap-1">
        {CELLS.map((cell) => (
          <span
            key={cell}
            className="grid size-8 place-items-center rounded-lg border text-[13px] font-semibold tabular-nums text-muted-foreground"
          >
            {cell}
          </span>
        ))}
      </div>
      <Input
        value={highLabel ?? ""}
        maxLength={SURVEY_LIMITS.labelMax}
        placeholder="מאוד"
        aria-label={`תווית לדירוג 5 בשאלה ${questionNumber}`}
        className="h-8 w-36"
        onChange={(event) => onChange({ lowLabel, highLabel: orNull(event.target.value) })}
      />
      <span className="text-xs text-muted-foreground">תוויות לקצוות, לא חובה</span>
    </div>
  );
}
