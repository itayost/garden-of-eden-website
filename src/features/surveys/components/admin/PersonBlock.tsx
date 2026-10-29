import { cn } from "@/lib/utils";
import { branchYearText, displayName, initialsOf } from "../../lib/results-view";

interface PersonBlockProps {
  fullName: string;
  branchNames: readonly string[];
  birthYear: number | null;
  /** The avatar goes grey for a Trainee who never saw the Survey. */
  muted?: boolean;
}

/** A Trainee as the results show them: initials, name, and "branch · year" under it. */
export function PersonBlock({ fullName, branchNames, birthYear, muted = false }: PersonBlockProps) {
  const detail = branchYearText(branchNames, birthYear);
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span
        aria-hidden="true"
        className={cn(
          "grid size-[26px] shrink-0 place-items-center rounded-full text-[11px] font-bold",
          muted ? "bg-muted text-muted-foreground" : "bg-secondary text-secondary-foreground",
        )}
      >
        {initialsOf(fullName)}
      </span>
      <span className="min-w-0 text-start">
        <span className="block truncate font-semibold">{displayName(fullName)}</span>
        {detail !== "" && <span className="block text-xs text-muted-foreground">{detail}</span>}
      </span>
    </span>
  );
}
