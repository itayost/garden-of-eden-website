"use client";

import { useState, useTransition, useCallback, useRef } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClickableTableRow } from "@/components/admin/ClickableTableRow";
import { SubmissionExportButton } from "@/components/admin/exports/SubmissionExportButton";
import { TableToolbar, ToolbarDateRange } from "@/components/admin/TableToolbar";
import { HasBadge, DifficultyBadge, SatisfactionBadge } from "@/components/ui/badges";
import { Activity, FileText, Salad, RefreshCw, type LucideIcon } from "lucide-react";
import { SimpleTablePagination } from "@/components/admin/TablePagination";
import type { PreWorkoutForm, PostWorkoutForm, NutritionForm } from "@/types/database";
import { formatDateTime } from "@/lib/utils/date";
import {
  getPreWorkoutPaginated,
  getPostWorkoutPaginated,
  getNutritionPaginated,
} from "@/lib/actions/admin-submissions-list";
import type { SubmissionQueryParams } from "@/lib/actions/admin-submissions-list";

type PostWorkoutWithTrainer = PostWorkoutForm & { trainer: { full_name: string } | null };

// Hebrew translations for form values
const nutritionStatusTranslations: Record<string, string> = {
  full_energy: "מלא אנרגיה",
  insufficient: "לא מספיק",
  no_energy: "אין אנרגיה",
};

function translateValue(value: string | null | undefined, translations: Record<string, string>): string {
  if (!value) return "-";
  return translations[value] || value;
}

function EmptyState({ icon: Icon, message }: { icon: LucideIcon; message: string }) {
  return (
    <div className="text-center py-8 text-muted-foreground">
      <Icon className="h-12 w-12 mx-auto mb-4 opacity-50" />
      <p>{message}</p>
    </div>
  );
}

const PAGE_SIZE = 20;

// Pre-workout content component
export function PreWorkoutContent({
  initialItems,
  initialTotal,
}: {
  initialItems: PreWorkoutForm[];
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
        const result = await getPreWorkoutPaginated(params);
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
                <CardTitle>שאלונים לפני אימון</CardTitle>
                <CardDescription>
                  {hasFilters
                    ? `מציג ${items.length} מתוך ${total} שאלונים`
                    : `כל השאלונים שהוגשו לפני אימונים`}
                </CardDescription>
              </div>
              {isPending && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            <SubmissionExportButton
              formType="pre_workout"
              submissions={items}
            />
          </div>
          <TableToolbar
            searchValue={search}
            onSearchChange={handleSearchChange}
            searchPlaceholder="חיפוש לפי שם..."
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
              {items.map((form) => (
                <Link
                  key={form.id}
                  href={`/admin/submissions/pre-workout/${form.id}`}
                  className="block p-3 rounded-lg border hover:bg-muted/50 transition-colors space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{form.full_name}</span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(form.submitted_at)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {form.sleep_hours && <span>שינה: {form.sleep_hours}</span>}
                    <span>{translateValue(form.nutrition_status, nutritionStatusTranslations)}</span>
                    <HasBadge value={!!(form.recent_injury && form.recent_injury !== "אין")} />
                  </div>
                </Link>
              ))}
            </div>

            {/* Desktop: Table */}
            <div className="overflow-x-auto hidden sm:block" dir="rtl">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>שם</TableHead>
                    <TableHead>גיל</TableHead>
                    <TableHead>שינה</TableHead>
                    <TableHead>תזונה</TableHead>
                    <TableHead>פציעה</TableHead>
                    <TableHead>תאריך</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((form) => (
                    <ClickableTableRow key={form.id} href={`/admin/submissions/pre-workout/${form.id}`}>
                      <TableCell className="font-medium">{form.full_name}</TableCell>
                      <TableCell>{form.age || "-"}</TableCell>
                      <TableCell>{form.sleep_hours || "-"}</TableCell>
                      <TableCell>{translateValue(form.nutrition_status, nutritionStatusTranslations)}</TableCell>
                      <TableCell>
                        <HasBadge value={!!(form.recent_injury && form.recent_injury !== "אין")} />
                      </TableCell>
                      <TableCell>{formatDateTime(form.submitted_at)}</TableCell>
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
              itemLabel="שאלונים"
            />
          </>
        ) : hasFilters ? (
          <EmptyState icon={Activity} message="אין שאלונים מתאימים לחיפוש" />
        ) : (
          <EmptyState icon={Activity} message="אין שאלונים עדיין" />
        )}
      </CardContent>
    </Card>
  );
}

// Post-workout content component
export function PostWorkoutContent({
  initialItems,
  initialTotal,
}: {
  initialItems: PostWorkoutWithTrainer[];
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
        const result = await getPostWorkoutPaginated(params);
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
                <CardTitle>שאלונים אחרי אימון</CardTitle>
                <CardDescription>
                  {hasFilters
                    ? `מציג ${items.length} מתוך ${total} שאלונים`
                    : `כל השאלונים שהוגשו אחרי אימונים`}
                </CardDescription>
              </div>
              {isPending && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            <SubmissionExportButton
              formType="post_workout"
              submissions={items}
            />
          </div>
          <TableToolbar
            searchValue={search}
            onSearchChange={handleSearchChange}
            searchPlaceholder="חיפוש לפי שם..."
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
              {items.map((form) => (
                <Link
                  key={form.id}
                  href={`/admin/submissions/post-workout/${form.id}`}
                  className="block p-3 rounded-lg border hover:bg-muted/50 transition-colors space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{form.full_name}</span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(form.submitted_at)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    {form.trainer?.full_name && (
                      <span className="text-muted-foreground">{form.trainer.full_name}</span>
                    )}
                    <DifficultyBadge level={form.difficulty_level} />
                    <SatisfactionBadge level={form.satisfaction_level} />
                  </div>
                  {form.comments && (
                    <p className="text-xs text-muted-foreground truncate">{form.comments}</p>
                  )}
                </Link>
              ))}
            </div>

            {/* Desktop: Table */}
            <div className="overflow-x-auto hidden sm:block" dir="rtl">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>שם</TableHead>
                    <TableHead>מאמן</TableHead>
                    <TableHead>קושי</TableHead>
                    <TableHead>שביעות רצון</TableHead>
                    <TableHead>הערות</TableHead>
                    <TableHead>תאריך</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((form) => (
                    <ClickableTableRow key={form.id} href={`/admin/submissions/post-workout/${form.id}`}>
                      <TableCell className="font-medium">{form.full_name}</TableCell>
                      <TableCell>{form.trainer?.full_name || "-"}</TableCell>
                      <TableCell><DifficultyBadge level={form.difficulty_level} /></TableCell>
                      <TableCell><SatisfactionBadge level={form.satisfaction_level} /></TableCell>
                      <TableCell className="max-w-[200px] truncate">{form.comments || "-"}</TableCell>
                      <TableCell>{formatDateTime(form.submitted_at)}</TableCell>
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
              itemLabel="שאלונים"
            />
          </>
        ) : hasFilters ? (
          <EmptyState icon={FileText} message="אין שאלונים מתאימים לחיפוש" />
        ) : (
          <EmptyState icon={FileText} message="אין שאלונים עדיין" />
        )}
      </CardContent>
    </Card>
  );
}

// Nutrition content component
export function NutritionContent({
  initialItems,
  initialTotal,
}: {
  initialItems: NutritionForm[];
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
        const result = await getNutritionPaginated(params);
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
                <CardTitle>שאלוני תזונה</CardTitle>
                <CardDescription>
                  {hasFilters
                    ? `מציג ${items.length} מתוך ${total} שאלונים`
                    : `כל שאלוני התזונה שהוגשו`}
                </CardDescription>
              </div>
              {isPending && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            <SubmissionExportButton
              formType="nutrition"
              submissions={items}
            />
          </div>
          <TableToolbar
            searchValue={search}
            onSearchChange={handleSearchChange}
            searchPlaceholder="חיפוש לפי שם..."
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
              {items.map((form) => (
                <Link
                  key={form.id}
                  href={`/admin/submissions/nutrition/${form.id}`}
                  className="block p-3 rounded-lg border hover:bg-muted/50 transition-colors space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{form.full_name}</span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(form.submitted_at)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {form.age && <span>גיל: {form.age}</span>}
                    {form.weight && <span>{form.weight} ק&quot;ג</span>}
                    {form.height && <span>{form.height} מ&apos;</span>}
                    <HasBadge value={form.allergies} />
                  </div>
                </Link>
              ))}
            </div>

            {/* Desktop: Table */}
            <div className="overflow-x-auto hidden sm:block" dir="rtl">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>שם</TableHead>
                    <TableHead>גיל</TableHead>
                    <TableHead>משקל</TableHead>
                    <TableHead>גובה</TableHead>
                    <TableHead>אלרגיות</TableHead>
                    <TableHead>תאריך</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((form) => (
                    <ClickableTableRow key={form.id} href={`/admin/submissions/nutrition/${form.id}`}>
                      <TableCell className="font-medium">{form.full_name}</TableCell>
                      <TableCell>{form.age}</TableCell>
                      <TableCell>{form.weight ? `${form.weight} ק"ג` : "-"}</TableCell>
                      <TableCell>{form.height ? `${form.height} מ'` : "-"}</TableCell>
                      <TableCell><HasBadge value={form.allergies} /></TableCell>
                      <TableCell>{formatDateTime(form.submitted_at)}</TableCell>
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
              itemLabel="שאלונים"
            />
          </>
        ) : hasFilters ? (
          <EmptyState icon={Salad} message="אין שאלונים מתאימים לחיפוש" />
        ) : (
          <EmptyState icon={Salad} message="אין שאלונים עדיין" />
        )}
      </CardContent>
    </Card>
  );
}
