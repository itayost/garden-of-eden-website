"use client";

import { useState, useTransition, useCallback, useRef } from "react";
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
import { SimpleTablePagination } from "@/components/admin/TablePagination";
import { ClipboardCheck, RefreshCw } from "lucide-react";
import type { TrainerShiftReport } from "@/types/database";
import { formatDateTime } from "@/lib/utils/date";
import { getShiftReportsPaginated } from "@/lib/actions/admin-submissions-list";
import type { SubmissionQueryParams } from "@/lib/actions/admin-submissions-list";

const PAGE_SIZE = 20;

function FlagBadge({ active, label }: { active: boolean; label: string }) {
  if (!active) return null;
  return <Badge variant="destructive" className="text-xs">{label}</Badge>;
}

export function ShiftReportContent({
  initialItems,
  initialTotal,
}: {
  initialItems: TrainerShiftReport[];
  initialTotal: number;
}) {
  const [items, setItems] = useState(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(0);
  const [isPending, startTransition] = useTransition();
  const requestIdRef = useRef(0);

  const fetchData = useCallback(
    (newPage: number, newSearch: string, newStartDate: string, newEndDate: string) => {
      const currentRequestId = ++requestIdRef.current;
      startTransition(async () => {
        const params: SubmissionQueryParams = {
          page: newPage,
          pageSize: PAGE_SIZE,
          search: newSearch || undefined,
          startDate: newStartDate || undefined,
          endDate: newEndDate || undefined,
        };
        const result = await getShiftReportsPaginated(params);
        if (currentRequestId === requestIdRef.current) {
          setItems(result.items);
          setTotal(result.total);
        }
      });
    },
    []
  );

  const handleSearchChange = (v: string) => {
    setSearch(v);
    setPage(0);
    fetchData(0, v, startDate, endDate);
  };
  const handleStartDateChange = (v: string) => {
    setStartDate(v);
    setPage(0);
    fetchData(0, search, v, endDate);
  };
  const handleEndDateChange = (v: string) => {
    setEndDate(v);
    setPage(0);
    fetchData(0, search, startDate, v);
  };
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchData(newPage, search, startDate, endDate);
  };

  const hasFilters = !!(search || startDate || endDate);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <div>
                <CardTitle>דוחות סוף משמרת</CardTitle>
                <CardDescription>
                  {hasFilters
                    ? `מציג ${items.length} מתוך ${total} דוחות`
                    : `כל הדוחות שהוגשו`}
                </CardDescription>
              </div>
              {isPending && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            <ShiftReportExportButton submissions={items} />
          </div>
          <TableToolbar
            searchValue={search}
            onSearchChange={handleSearchChange}
            searchPlaceholder="חיפוש לפי שם מאמן..."
            filters={
              <ToolbarDateRange
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={handleStartDateChange}
                onEndDateChange={handleEndDateChange}
              />
            }
          />
        </div>
      </CardHeader>
      <CardContent>
        {items.length > 0 ? (
          <>
            {/* Mobile: Card list */}
            <div className="space-y-2 sm:hidden">
              {items.map((report) => (
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
                  {items.map((report) => (
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

            <SimpleTablePagination
              totalItems={total}
              pageSize={PAGE_SIZE}
              currentPage={page}
              onPageChange={handlePageChange}
              itemLabel="דוחות"
            />
          </>
        ) : hasFilters ? (
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
