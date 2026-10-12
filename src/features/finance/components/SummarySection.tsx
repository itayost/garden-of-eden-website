"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { useIsMobile } from "@/hooks/useIsMobile";
import { cn } from "@/lib/utils";

/**
 * A summary block: always open on desktop; on a phone it collapses unless it
 * is the one staff need first (the cash-up).
 */
export function SummarySection({
  title,
  meta,
  openOnPhone = false,
  children,
}: {
  title: string;
  meta?: string;
  openOnPhone?: boolean;
  children: ReactNode;
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(openOnPhone);
  const shown = !isMobile || open;

  return (
    <section className="border-t px-4 py-4 first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={shown}
        disabled={!isMobile}
        className="flex w-full items-baseline justify-between gap-3 text-start disabled:cursor-default"
      >
        <h2 className="text-sm font-bold">{title}</h2>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          {meta}
          {isMobile && <ChevronDown className={cn("h-4 w-4 transition-transform", shown && "rotate-180")} />}
        </span>
      </button>
      {shown && <div className="mt-3">{children}</div>}
    </section>
  );
}
