interface VerbalPanelProps {
  verbalTextHe: string | null;
  verbalTipHe: string | null;
}

export function VerbalPanel({ verbalTextHe, verbalTipHe }: VerbalPanelProps) {
  if (!verbalTextHe && !verbalTipHe) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        אין תוכן בעל-פה לפרמטר זה
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {verbalTextHe && (
        <p className="text-sm text-muted-foreground leading-relaxed font-light border-s-2 border-s-sky-400 ps-3">
          {verbalTextHe}
        </p>
      )}
      {verbalTipHe && (
        <div className="rounded-lg border border-sky-400/15 bg-sky-400/6 px-4 py-3">
          <p className="text-xs text-sky-600 dark:text-sky-400 leading-relaxed">
            {verbalTipHe}
          </p>
        </div>
      )}
    </div>
  );
}
