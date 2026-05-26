"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LeadTabsManager } from "./LeadTabsManager";
import type { LeadTab } from "@/types/lead-tabs";

interface LeadsTabsProps {
  tabs: LeadTab[];
  activeSlug: string;
  counts?: Record<string, number>;
  canManage: boolean;
}

export function LeadsTabs({
  tabs,
  activeSlug,
  counts,
  canManage,
}: LeadsTabsProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [managerOpen, setManagerOpen] = useState(false);

  const buildHref = (slug: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", slug);
    params.delete("source"); // drop the legacy alias when the user picks a tab
    return `${pathname}?${params.toString()}`;
  };

  return (
    <>
      <div
        className="flex items-center gap-2 flex-wrap"
        role="tablist"
        aria-label="סוג ליד"
      >
        <div className="bg-muted text-muted-foreground inline-flex h-9 items-center justify-center rounded-lg p-[3px]">
          {tabs.map((tab) => {
            const active = tab.slug === activeSlug;
            const count = counts?.[tab.slug];
            return (
              <Link
                key={tab.id}
                href={buildHref(tab.slug)}
                scroll={false}
                role="tab"
                aria-selected={active}
                className={cn(
                  "inline-flex h-[calc(100%-1px)] shrink-0 items-center justify-center gap-1.5 rounded-md border border-transparent px-3 py-1 text-sm font-medium whitespace-nowrap transition-colors",
                  active
                    ? "bg-background text-foreground shadow-sm"
                    : "text-foreground/80 hover:bg-background/60",
                )}
              >
                {tab.name}
                {typeof count === "number" && (
                  <span className="text-xs text-muted-foreground">
                    ({count})
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {canManage && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setManagerOpen(true)}
            aria-label="ניהול טאבים"
          >
            <Settings2 className="h-4 w-4 ml-1" />
            ניהול טאבים
          </Button>
        )}
      </div>

      <LeadTabsManager
        open={managerOpen}
        onOpenChange={setManagerOpen}
        tabs={tabs}
      />
    </>
  );
}
