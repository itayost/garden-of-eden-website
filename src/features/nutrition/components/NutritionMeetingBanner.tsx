"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, ArrowLeft, X } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { shouldShowNutritionMeeting } from "../lib/utils";

const DISMISS_KEY = "nutrition-meeting-banner-dismissed";

interface NutritionMeetingBannerProps {
  userCreatedAt: string;
  className?: string;
}

export function NutritionMeetingBanner({
  userCreatedAt,
  className,
}: NutritionMeetingBannerProps) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === "true");
  }, []);

  if (
    dismissed ||
    !userCreatedAt ||
    !shouldShowNutritionMeeting(userCreatedAt)
  ) {
    return null;
  }

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, "true");
    setDismissed(true);
  };

  return (
    <Card className={cn("border-blue-500/50 bg-blue-500/5", className)}>
      <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-4 py-4">
        <div className="flex items-center gap-4 flex-1">
          <div className="bg-blue-500 rounded-full p-2 shrink-0">
            <Calendar className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="font-semibold">זמן לפגישת תזונה</p>
            <p className="text-sm text-muted-foreground">
              חלף חודש מההצטרפות שלך - מומלץ לתאם פגישה עם יועצ/ת תזונה
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button asChild className="w-full sm:w-auto">
            <Link href="/dashboard/nutrition">
              לדף התזונה
              <ArrowLeft className="mr-2 h-4 w-4" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDismiss}
            className="shrink-0"
            aria-label="סגור"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
