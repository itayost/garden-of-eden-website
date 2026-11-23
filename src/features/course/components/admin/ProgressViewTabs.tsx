import Link from "next/link";

import { cn } from "@/lib/utils";

export type ProgressView = "trainees" | "lessons";

/** ?view=lessons, anything else is the per-trainee list. */
export function progressViewFrom(value: string | undefined): ProgressView {
  return value === "lessons" ? "lessons" : "trainees";
}

/** The query a link adds to keep the chosen view. */
export function progressViewQuery(view: ProgressView): string {
  return view === "lessons" ? "&view=lessons" : "";
}

const VIEWS: readonly { view: ProgressView; label: string }[] = [
  { view: "trainees", label: "לפי מתאמן" },
  { view: "lessons", label: "לפי שיעור" },
];

interface ProgressViewTabsProps {
  courseSlug: string;
  current: ProgressView;
}

/** Per trainee or per lesson; the choice lives in ?view= so it survives reloads. */
export function ProgressViewTabs({ courseSlug, current }: ProgressViewTabsProps) {
  return (
    <nav aria-label="אופן התצוגה" className="inline-flex rounded-lg border border-border p-0.5">
      {VIEWS.map(({ view, label }) => (
        <Link
          key={view}
          href={`/admin/course/progress?course=${courseSlug}${progressViewQuery(view)}`}
          aria-current={view === current ? "page" : undefined}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm transition-colors",
            view === current
              ? "bg-primary font-medium text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
