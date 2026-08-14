import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface NumberFieldProps extends React.ComponentProps<typeof Input> {
  id: string;
  label: string;
}

/**
 * A small labelled numeric input, for grids of measure values.
 *
 * Spreads the rest of its props onto the Input so a react-hook-form
 * `register()` result (which carries a ref) passes straight through.
 */
export function NumberField({ id, label, ...inputProps }: NumberFieldProps) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-muted-foreground text-xs font-normal">
        {label}
      </Label>
      <Input id={id} type="number" inputMode="decimal" {...inputProps} />
    </div>
  );
}
