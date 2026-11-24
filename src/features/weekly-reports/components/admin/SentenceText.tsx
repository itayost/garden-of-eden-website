import { cn } from "@/lib/utils";
import type { SentenceView, TextPiece } from "../../lib/sentence-facts";

function Piece({ piece }: { piece: TextPiece }) {
  switch (piece.kind) {
    case "name":
      return <span className="font-semibold">{piece.text}</span>;
    case "known_number":
      return <span className="underline decoration-success decoration-2 underline-offset-4">{piece.text}</span>;
    case "unknown_number":
      return (
        <mark title="מספר שלא מופיע בנתונים" className="rounded bg-destructive/10 px-0.5 font-bold text-destructive">
          {piece.text}
        </mark>
      );
    default:
      return <>{piece.text}</>;
  }
}

function Sentence({ view }: { view: SentenceView }) {
  return (
    <div className="grid gap-1.5 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/60 @md:grid-cols-[minmax(0,1fr)_11rem] @md:gap-4">
      <p className="m-0 leading-relaxed">
        {view.pieces.map((piece, index) => (
          <Piece key={index} piece={piece} />
        ))}
      </p>
      {view.facts.length > 0 && (
        <ul className="flex flex-wrap content-start gap-1 @md:flex-col @md:items-start" aria-label="מהנתונים">
          {view.facts.map((fact) => (
            <li
              key={fact.label}
              className="max-w-full truncate rounded-md bg-success/10 px-1.5 py-px text-[11px] font-medium text-success"
            >
              {fact.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * A text read the way staff check it: sentence by sentence, each with the
 * facts it seems to rest on beside it (below it on a narrow column), every
 * number underlined when the facts hold it and marked red when they do not.
 */
export function SentenceText({ paragraphs, className }: { paragraphs: SentenceView[][]; className?: string }) {
  if (paragraphs.length === 0) return <p className="text-sm text-muted-foreground">הטקסט עוד לא נכתב</p>;
  return (
    <div className={cn("@container space-y-3 text-[15px]", className)}>
      {paragraphs.map((paragraph, index) => (
        <div key={index} className="space-y-0.5">
          {paragraph.map((view, i) => (
            <Sentence key={i} view={view} />
          ))}
        </div>
      ))}
    </div>
  );
}
