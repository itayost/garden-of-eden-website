"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClickableTableRow } from "@/components/admin/ClickableTableRow";
import { TableToolbar, ToolbarDateRange } from "@/components/admin/TableToolbar";
import { ShiftReportExportButton } from "@/components/admin/exports/ShiftReportExportButton";
import { ClipboardCheck } from "lucide-react";
import type { TrainerShiftReport } from "@/types/database";
import { formatDateTime } from "@/lib/utils/date";

function FlagBadge({ active, label }: { active: boolean; label: string }) {
  if (!active) return null;
  return <Badge variant="destructive" className="text-xs">{label}</Badge>;
}

export function ShiftReportContent({ submissions }: { submissions: TrainerShiftReport[] }) {
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const filtered = useMemo(() => {
    let result = submissions;

    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter((s) => s.trainer_name.toLowerCase().includes(searchLower));
    }

    if (startDate) {
      result = result.filter((s) => s.report_date >= startDate);
    }
    if (endDate) {
      result = result.filter((s) => s.report_date <= endDate);
    }
    return result;
  }, [submissions, search, startDate, endDate]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>דוחות סוף משמרת</CardTitle>
              <CardDescription>
                {filtered.length === submissions.length
                  ? `כל הדוחות שהוגשו`
                  : `מציג ${filtered.length} מתוך ${submissions.length} דוחות`}
              </CardDescription>
            </div>
            <ShiftReportExportButton submissions={filtered} />
          </div>
          <TableToolbar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="חיפוש לפי שם מאמן..."
            filters={
              <ToolbarDateRange
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
              />
            }
          />
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length > 0 ? (
          <>
            {/* Mobile: Card list */}
            <div className="space-y-2 sm:hidden">
              {filtered.map((report) => (
                <Link
                  key={report.id}
                  href={`/admin/submissions/shift-reports/${report.id}`}
                  className="block p-3 rounded-lg border hover:bg-muted/50 transition-colors space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{report.trainer_name}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(report.report_date).toLocaleDateString("he-IL")}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <FlagBadge active={report.has_injuries} label="פציעה" />
                    <FlagBadge active={report.has_discipline_issues} label="משמעת" />
                    <FlagBadge active={report.has_poor_mental_state} label="מצב נפשי" />
                    <FlagBadge active={report.has_complaints} label="תלונות" />
                    <FlagBadge active={report.has_pro_candidates} label="PRO" />
                    <FlagBadge active={!report.facility_left_clean} label="ניקיון" />
                    {!report.has_injuries &&
                      !report.has_discipline_issues &&
                      !report.has_poor_mental_state &&
                      !report.has_complaints &&
                      !report.has_pro_candidates &&
                      report.facility_left_clean && (
                        <Badge variant="secondary" className="text-xs">תקין</Badge>
                      )}
                  </div>
                </Link>
              ))}
            </div>

            {/* Desktop: Table */}
            <div className="overflow-x-auto hidden sm:block" dir="rtl">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>מאמן</TableHead>
                    <TableHead>תאריך</TableHead>
                    <TableHead>סימונים</TableHead>
                    <TableHead>הוגש</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((report) => (
                    <ClickableTableRow
                      key={report.id}
                      href={`/admin/submissions/shift-reports/${report.id}`}
                    >
                      <TableCell className="font-medium">
                        {report.trainer_name}
                      </TableCell>
                      <TableCell>
                        {new Date(report.report_date).toLocaleDateString("he-IL")}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <FlagBadge active={report.has_injuries} label="פציעה" />
                          <FlagBadge active={report.has_discipline_issues} label="משמעת" />
                          <FlagBadge active={report.has_poor_mental_state} label="מצב נפשי" />
                          <FlagBadge active={report.has_complaints} label="תלונות" />
                          <FlagBadge active={report.has_pro_candidates} label="PRO" />
                          <FlagBadge active={!report.facility_left_clean} label="ניקיון" />
                          {!report.has_injuries &&
                            !report.has_discipline_issues &&
                            !report.has_poor_mental_state &&
                            !report.has_complaints &&
                            !report.has_pro_candidates &&
                            report.facility_left_clean && (
                              <Badge variant="secondary" className="text-xs">תקין</Badge>
                            )}
                        </div>
                      </TableCell>
                      <TableCell>{formatDateTime(report.submitted_at)}</TableCell>
                    </ClickableTableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        ) : submissions.length > 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ClipboardCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>אין דוחות מתאימים לחיפוש</p>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <ClipboardCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>אין דוחות עדיין</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
