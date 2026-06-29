"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { cn } from "@/lib/utils";
import { Filter } from "lucide-react";

interface MyContentToggleProps {
  showAll: boolean;
}

export function MyContentToggle({ showAll }: MyContentToggleProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const toggle = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (showAll) {
      params.delete("all");
    } else {
      params.set("all", "1");
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }, [router, pathname, searchParams, showAll]);

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        showAll
          ? "border-border bg-muted text-muted-foreground hover:bg-card hover:text-foreground"
          : "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
      )}
    >
      <Filter className="h-3.5 w-3.5 shrink-0" />
      {showAll ? "הצג תכנים שלי בלבד" : "הצג הכל"}
    </button>
  );
}
