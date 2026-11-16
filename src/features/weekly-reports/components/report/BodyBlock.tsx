import { shortDate } from "@/lib/utils/iso-date";
import type { BodyFacts } from "../../lib/fact-sheet/types";
import { bodyRows } from "../../lib/report-view";

/**
 * The week's measurement and the dietitian's recommendation, shown as they
 * are. Added by code, never written or seen by the model. Renders nothing when
 * the measurement holds no number and there is no recommendation.
 */
export function BodyBlock({ body }: { body: BodyFacts }) {
  const rows = bodyRows(body);
  const note = body.dietitianNote?.trim();
  if (rows.length === 0 && !note) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-bold">מדידה מ-{shortDate(body.date)}</h2>
      {rows.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          {rows.map((row) => (
            <div key={row.label}>
              <dt className="text-xs text-muted-foreground">{row.label}</dt>
              <dd className="text-sm font-medium tabular-nums">
                {row.value}
                {row.change && (
                  // Its own direction, so the sign stays before the number.
                  <span dir="ltr" className="ms-1 text-xs font-normal text-muted-foreground">
                    ({row.change})
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {note && (
        <p className="text-sm">
          <span className="font-bold">המלצת התזונאית:</span> <span className="whitespace-pre-line">{note}</span>
        </p>
      )}
    </section>
  );
}
