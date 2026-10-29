"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

interface CollapsibleSectionProps {
  title: string;
  icon?: ReactNode;
  /** The one line a folded section shows on a phone. */
  summary: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

const HEADING = "text-sm font-bold";

/**
 * A section of the settings column. From lg it is a plain heading over its
 * fields, always open. On a phone the heading is a button that folds the
 * section down to its one-line summary. The two headings are separate
 * elements so a desktop keyboard never lands on a button that does nothing.
 */
export function CollapsibleSection({ title, icon, summary, open, onToggle, children }: CollapsibleSectionProps) {
  return (
    <section className="flex flex-col gap-3 border-t px-4 py-3.5 first:border-t-0 lg:gap-3.5 lg:px-[18px] lg:py-4">
      <h3 className="lg:hidden">
        <button
          type="button"
          aria-expanded={open}
          onClick={onToggle}
          className={cn(HEADING, "flex w-full items-center gap-2 text-start outline-none focus-visible:ring-[3px] focus-visible:ring-ring")}
        >
          {icon}
          {title}
          <ChevronDown
            aria-hidden="true"
            className={cn("ms-auto size-4 text-muted-foreground transition-transform", open && "rotate-180")}
          />
        </button>
      </h3>
      <h3 className={cn(HEADING, "hidden lg:block")}>{title}</h3>
      {!open && <p className="text-[13px] text-muted-foreground lg:hidden">{summary}</p>}
      <div className={cn(open ? "flex" : "hidden", "flex-col gap-3.5 lg:flex")}>{children}</div>
    </section>
  );
}
