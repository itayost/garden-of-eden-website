import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DateFieldProps {
  id: string;
  label: string;
  optional?: boolean;
  /** YYYY-MM-DD, or "" for no date. */
  value: string;
  min?: string;
  hint?: string;
  onChange: (next: string) => void;
}

/** A labelled day. The browser's own date control picks it, in the viewer's locale. */
export function DateField({ id, label, optional = false, value, min, hint, onChange }: DateFieldProps) {
  const hintId = `${id}-hint`;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        {optional && (
          <>
            {" "}
            <span className="text-xs font-normal text-muted-foreground">לא חובה</span>
          </>
        )}
      </Label>
      <Input
        id={id}
        type="date"
        value={value}
        min={min}
        aria-describedby={hint === undefined ? undefined : hintId}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint !== undefined && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}
