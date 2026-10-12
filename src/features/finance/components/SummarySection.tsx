"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A summary block: always open on desktop; on a phone it collapses unless it
 * is the one staff need first (the cash-up). CSS does the desktop case, so the
 * server render has no flash.
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
  const [open, setOpen] = useState(openOnPhone);

  return (
    <section className="border-t px-4 py-4 first:border-t-0">
      {/* The heading holds the button: a heading inside a button loses its role. */}
      <h2 className="text-sm font-bold">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-baseline justify-between gap-3 text-start md:pointer-events-none md:cursor-default"
        >
          <span>{title}</span>
          <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
            {meta}
            <ChevronDown className={cn("h-4 w-4 transition-transform md:hidden", open && "rotate-180")} aria-hidden />
          </span>
        </button>
      </h2>
      <div className={cn("mt-3", !open && "max-md:hidden")}>{children}</div>
    </section>
  );
}
