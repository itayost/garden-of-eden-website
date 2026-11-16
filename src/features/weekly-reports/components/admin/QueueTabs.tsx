import Link from "next/link";
import { cn } from "@/lib/utils";
import { QUEUE_TABS, queueHref, type QueueLocation, type QueueTab, type TabCounts } from "../../lib/queue-view";

interface QueueTabsProps {
  active: QueueTab;
  counts: TabCounts;
  /** The week and branch in view; a tab keeps them and closes the open report. */
  location: Omit<QueueLocation, "tab" | "report">;
}

/**
 * The seven tabs, each with its count (the last, הצעות יעד, counts the open
 * Goal proposals of every week); a strip that scrolls sideways on a phone.
 */
export function QueueTabs({ active, counts, location }: QueueTabsProps) {
  return (
    <nav aria-label="סטטוס הדוחות" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-1 rounded-lg bg-muted p-1 sm:w-auto sm:flex-wrap">
        {QUEUE_TABS.map(({ tab, label }) => {
          const selected = tab === active;
          return (
            <li key={tab}>
              <Link
                href={queueHref({ ...location, tab })}
                scroll={false}
                aria-current={selected ? "page" : undefined}
                className={cn(
                  "flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  selected ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-xs tabular-nums",
                    selected ? "bg-muted" : "bg-background/60",
                    tab === "held" && counts.held > 0 && "bg-warning/25 text-warning-emphasis",
                  )}
                >
                  {counts[tab]}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
