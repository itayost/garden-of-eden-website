import Link from "next/link";
import { cn } from "@/lib/utils";
import { filterCount, QUEUE_FILTERS, queueHref, type QueueFilter, type QueueLocation, type TabCounts } from "../../lib/queue-view";

interface QueueFiltersProps {
  active: QueueFilter;
  counts: TabCounts;
  /** The week and branch in view; a filter keeps them and closes the open report. */
  location: Omit<QueueLocation, "tab" | "report">;
}

/** The list's filters with their counts; a row of chips that scrolls sideways on a phone. */
export function QueueFilters({ active, counts, location }: QueueFiltersProps) {
  return (
    <nav aria-label="סינון הדוחות" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-1.5 sm:w-auto sm:flex-wrap">
        {QUEUE_FILTERS.map(({ filter, label }) => {
          const selected = filter === active;
          const count = filterCount(filter, counts);
          return (
            <li key={filter}>
              <Link
                href={queueHref({ ...location, tab: filter })}
                scroll={false}
                aria-current={selected ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                  selected
                    ? "border-foreground bg-foreground text-background"
                    : "bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                )}
              >
                {label}
                <span className="tabular-nums opacity-80">{count}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
