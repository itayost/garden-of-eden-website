"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { ReportData } from "../types";

interface ReportDetailsSectionProps {
  profile: ReportData["profile"];
  attendance: ReportData["attendance"];
}

export function ReportDetailsSection({
  profile,
  attendance,
}: ReportDetailsSectionProps) {
  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("he-IL");

  const details = [
    { label: "שם השחקן", value: profile.full_name },
    { label: "תאריך לידה", value: profile.birthdate ? formatDate(profile.birthdate) : null },
    { label: "עמדה", value: profile.position },
    { label: "מועדון / קבוצה", value: profile.club },
    { label: "תאריך הצטרפות", value: formatDate(profile.created_at) },
    {
      label: "תדירות הגעה בממוצע",
      value: attendance
        ? `${attendance.weeklyAverage.toFixed(1)} בשבוע`
        : "לא זמין",
    },
  ];

  return (
    <Card data-testid="report-details">
      <CardHeader>
        <CardTitle>פרטי שחקן</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-6">
          <Avatar className="h-24 w-24">
            <AvatarImage src={profile.avatar_url ?? undefined} />
            <AvatarFallback>
              {profile.full_name?.charAt(0) ?? "?"}
            </AvatarFallback>
          </Avatar>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-2 flex-1">
            {details.map(({ label, value }) => (
              <div key={label}>
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="font-medium">{value ?? "---"}</dd>
              </div>
            ))}
          </dl>
        </div>
      </CardContent>
    </Card>
  );
}
