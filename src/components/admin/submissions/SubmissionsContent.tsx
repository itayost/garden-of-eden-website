"use client";

import { useState, useMemo } from "react";
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
import { Activity, FileText, Salad, type LucideIcon } from "lucide-react";
import { SimpleTablePagination } from "@/components/admin/TablePagination";
import type { PreWorkoutForm, PostWorkoutForm, NutritionForm } from "@/types/database";
import { formatDateTime } from "@/lib/utils/date";

type PostWorkoutWithTrainer = PostWorkoutForm & { trainers: { name: string } | null };

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

/** Filter submissions by name, start date, and end date */
function filterSubmissions<T extends { submitted_at: string; full_name: string }>(
  submissions: T[],
  search: string,
  startDate: string,
  endDate: string
): T[] {
  let filtered = submissions;

  if (search) {
    const searchLower = search.toLowerCase();
    filtered = filtered.filter((s) => s.full_name.toLowerCase().includes(searchLower));
  }

  if (startDate) {
    filtered = filtered.filter((s) => s.submitted_at >= startDate);
  }
  if (endDate) {
    filtered = filtered.filter((s) => s.submitted_at <= endDate + "T23:59:59");
  }
  return filtered;
}

// Pre-workout content component
const PAGE_SIZE = 20;

export function PreWorkoutContent({ submissions }: { submissions: PreWorkoutForm[] }) {
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(
    () => filterSubmissions(submissions, search, startDate, endDate),
    [submissions, search, startDate, endDate]
  );

  const handleSearchChange = (v: string) => { setSearch(v); setPage(0); };
  const handleStartDateChange = (v: string) => { setStartDate(v); setPage(0); };
  const handleEndDateChange = (v: string) => { setEndDate(v); setPage(0); };

  const paginated = useMemo(
    () => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filtered, page]
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>שאלונים לפני אימון</CardTitle>
              <CardDescription>
                {filtered.length === submissions.length
                  ? `כל השאלונים שהוגשו לפני אימונים`
                  : `מציג ${filtered.length} מתוך ${submissions.length} שאלונים`}
              </CardDescription>
            </div>
            <SubmissionExportButton
              formType="pre_workout"
              submissions={filtered}
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
        {filtered.length > 0 ? (
          <>
            {/* Mobile: Card list */}
            <div className="space-y-2 sm:hidden">
              {paginated.map((form) => (
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
                  {paginated.map((form) => (
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
              totalItems={filtered.length}
              pageSize={PAGE_SIZE}
              currentPage={page}
              onPageChange={setPage}
              itemLabel="שאלונים"
            />
          </>
        ) : submissions.length > 0 ? (
          <EmptyState icon={Activity} message="אין שאלונים מתאימים לחיפוש" />
        ) : (
          <EmptyState icon={Activity} message="אין שאלונים עדיין" />
        )}
      </CardContent>
    </Card>
  );
}

// Post-workout content component
export function PostWorkoutContent({ submissions }: { submissions: PostWorkoutWithTrainer[] }) {
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(
    () => filterSubmissions(submissions, search, startDate, endDate),
    [submissions, search, startDate, endDate]
  );

  const handleSearchChange = (v: string) => { setSearch(v); setPage(0); };
  const handleStartDateChange = (v: string) => { setStartDate(v); setPage(0); };
  const handleEndDateChange = (v: string) => { setEndDate(v); setPage(0); };

  const paginated = useMemo(
    () => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filtered, page]
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>שאלונים אחרי אימון</CardTitle>
              <CardDescription>
                {filtered.length === submissions.length
                  ? `כל השאלונים שהוגשו אחרי אימונים`
                  : `מציג ${filtered.length} מתוך ${submissions.length} שאלונים`}
              </CardDescription>
            </div>
            <SubmissionExportButton
              formType="post_workout"
              submissions={filtered}
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
        {filtered.length > 0 ? (
          <>
            {/* Mobile: Card list */}
            <div className="space-y-2 sm:hidden">
              {paginated.map((form) => (
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
                    {form.trainers?.name && (
                      <span className="text-muted-foreground">{form.trainers.name}</span>
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
                  {paginated.map((form) => (
                    <ClickableTableRow key={form.id} href={`/admin/submissions/post-workout/${form.id}`}>
                      <TableCell className="font-medium">{form.full_name}</TableCell>
                      <TableCell>{form.trainers?.name || "-"}</TableCell>
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
              totalItems={filtered.length}
              pageSize={PAGE_SIZE}
              currentPage={page}
              onPageChange={setPage}
              itemLabel="שאלונים"
            />
          </>
        ) : submissions.length > 0 ? (
          <EmptyState icon={FileText} message="אין שאלונים מתאימים לחיפוש" />
        ) : (
          <EmptyState icon={FileText} message="אין שאלונים עדיין" />
        )}
      </CardContent>
    </Card>
  );
}

// Nutrition content component
export function NutritionContent({ submissions }: { submissions: NutritionForm[] }) {
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(
    () => filterSubmissions(submissions, search, startDate, endDate),
    [submissions, search, startDate, endDate]
  );

  const handleSearchChange = (v: string) => { setSearch(v); setPage(0); };
  const handleStartDateChange = (v: string) => { setStartDate(v); setPage(0); };
  const handleEndDateChange = (v: string) => { setEndDate(v); setPage(0); };

  const paginated = useMemo(
    () => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filtered, page]
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>שאלוני תזונה</CardTitle>
              <CardDescription>
                {filtered.length === submissions.length
                  ? `כל שאלוני התזונה שהוגשו`
                  : `מציג ${filtered.length} מתוך ${submissions.length} שאלונים`}
              </CardDescription>
            </div>
            <SubmissionExportButton
              formType="nutrition"
              submissions={filtered}
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
        {filtered.length > 0 ? (
          <>
            {/* Mobile: Card list */}
            <div className="space-y-2 sm:hidden">
              {paginated.map((form) => (
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
                  {paginated.map((form) => (
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
              totalItems={filtered.length}
              pageSize={PAGE_SIZE}
              currentPage={page}
              onPageChange={setPage}
              itemLabel="שאלונים"
            />
          </>
        ) : submissions.length > 0 ? (
          <EmptyState icon={Salad} message="אין שאלונים מתאימים לחיפוש" />
        ) : (
          <EmptyState icon={Salad} message="אין שאלונים עדיין" />
        )}
      </CardContent>
    </Card>
  );
}
