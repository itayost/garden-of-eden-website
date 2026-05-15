"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { LEAD_SOURCE_LABELS, type LeadSource } from "@/types/leads";

const SOURCES: LeadSource[] = ["paid", "organic"];

interface LeadsTabsProps {
  current: LeadSource;
  counts?: Partial<Record<LeadSource, number>>;
}

/**
 * URL-driven tab switcher between paid and organic leads.
 * Preserves all other search params (q, status, haifa, etc.) when switching.
 */
export function LeadsTabs({ current, counts }: LeadsTabsProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const buildHref = (source: LeadSource) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("source", source);
    return `${pathname}?${params.toString()}`;
  };

  return (
    <div
      className="bg-muted text-muted-foreground inline-flex h-9 items-center justify-center rounded-lg p-[3px]"
      role="tablist"
      aria-label="סוג ליד"
    >
      {SOURCES.map((source) => {
        const active = current === source;
        const count = counts?.[source];
        return (
          <Link
            key={source}
            href={buildHref(source)}
            scroll={false}
            role="tab"
            aria-selected={active}
            className={cn(
              "inline-flex h-[calc(100%-1px)] shrink-0 items-center justify-center gap-1.5 rounded-md border border-transparent px-3 py-1 text-sm font-medium whitespace-nowrap transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-foreground/80 hover:bg-background/60"
            )}
          >
            {LEAD_SOURCE_LABELS[source]}
            {typeof count === "number" && (
              <span className="text-xs text-muted-foreground">({count})</span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
