interface ParentsPanelProps {
  reportTextHe: string | null;
  reportHighlightHe: string | null;
}

export function ParentsPanel({ reportTextHe, reportHighlightHe }: ParentsPanelProps) {
  if (!reportTextHe && !reportHighlightHe) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        אין תוכן להורים לפרמטר זה
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {reportTextHe && (
        <p className="text-sm text-muted-foreground leading-relaxed font-light">
          {reportTextHe}
        </p>
      )}
      {reportHighlightHe && (
        <div className="rounded-lg border border-primary/15 bg-primary/6 px-4 py-3">
          <p className="text-xs text-primary leading-relaxed">{reportHighlightHe}</p>
        </div>
      )}
    </div>
  );
}
