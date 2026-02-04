"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { shouldShowNutritionMeeting } from "../lib/utils";

interface NutritionMeetingBannerProps {
  userCreatedAt: string;
  className?: string;
}

export function NutritionMeetingBanner({
  userCreatedAt,
  className,
}: NutritionMeetingBannerProps) {
  if (!userCreatedAt || !shouldShowNutritionMeeting(userCreatedAt)) {
    return null;
  }

  return (
    <Card className={cn("border-blue-500/50 bg-blue-500/5", className)}>
      <CardContent className="flex items-center justify-between py-4">
        <div className="flex items-center gap-4">
          <div className="bg-blue-500 rounded-full p-2">
            <Calendar className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="font-semibold">זמן לפגישת תזונה</p>
            <p className="text-sm text-muted-foreground">
              חלף חודש מההצטרפות שלך - מומלץ לתאם פגישה עם יועצ/ת תזונה
            </p>
          </div>
        </div>
        <Button asChild>
          <Link href="/dashboard/nutrition">
            לדף התזונה
            <ArrowLeft className="mr-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
