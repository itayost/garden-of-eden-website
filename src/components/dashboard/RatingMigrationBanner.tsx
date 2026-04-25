"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "rating-migration-banner-dismissed-2026-04-25";

export function RatingMigrationBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Read once at mount to avoid SSR/hydration mismatch. The cascading
    // render this triggers is intentional and a one-shot.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(!localStorage.getItem(STORAGE_KEY));
  }, []);

  if (!visible) return null;

  return (
    <div
      className="rounded-md border border-primary/20 bg-primary/5 p-3 flex items-start gap-3"
      dir="rtl"
    >
      <div className="flex-1 text-sm">
        <p className="font-medium mb-1">עדכון לדירוגים שלך</p>
        <p className="text-muted-foreground">
          העדכנו את אופן חישוב הדירוג ההיסטורי. התוצאות עכשיו יציבות לאורך זמן —
          המספרים בגרף לא ישתנו רטרואקטיבית כשמתאמנים חדשים מצטרפים.
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label="סגור"
        className="shrink-0"
        onClick={() => {
          localStorage.setItem(STORAGE_KEY, "1");
          setVisible(false);
        }}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
