import { formatIls } from "@/lib/utils/money";
import { cn } from "@/lib/utils";

/** An amount isolated left-to-right, so RTL text keeps its sign in place. */
export function Money({ amount, className }: { amount: number; className?: string }) {
  return (
    <span dir="ltr" className={cn("tabular-nums", className)}>
      {formatIls(amount)}
    </span>
  );
}
