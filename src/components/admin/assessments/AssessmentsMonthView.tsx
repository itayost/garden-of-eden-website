"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { parseAsString, useQueryState } from "nuqs";
import Link from "next/link";
import { toast } from "sonner";
import { RefreshCw, Users, ClipboardCheck, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableToolbar, ToolbarSelect } from "@/components/admin/TableToolbar";
import { SimpleTablePagination } from "@/components/admin/TablePagination";
import {
  AGE_GROUPS,
  getAgeGroup,
  getAssessmentCompleteness,
  computeSectionCompleteness,
} from "@/types/assessment";
import { AssessmentStatusBadge } from "./AssessmentStatusBadge";
import { AssessmentSectionPopover } from "./AssessmentSectionPopover";
import { AssessmentDetailDialog } from "./AssessmentDetailDialog";
import { getAssessmentsByMonth } from "@/lib/actions/admin-assessments-month";
import type { AssessmentMonthResult } from "@/lib/actions/admin-assessments-month";
import type { AssessmentMonthStatus } from "@/types/assessment";
import type { Profile } from "@/types/database";
import type { PlayerAssessment } from "@/types/assessment";

interface AssessmentsMonthViewProps {
  month: number;
  year: number;
}

const PAGE_SIZE = 20;

const ageGroupOptions = [
  { value: "all", label: "כל קבוצות הגיל" },
  ...AGE_GROUPS.map((g) => ({ value: g.id, label: g.labelHe })),
];

const STATUS_FILTER_OPTIONS: {
  value: string;
  label: string;
  status: AssessmentMonthStatus | "all";
}[] = [
  { value: "all", label: "הכל", status: "all" },
  { value: "full", label: "מלא", status: "full" },
  { value: "partial", label: "חלקי", status: "partial" },
  { value: "none", label: "חסר", status: "none" },
];

const MONTHS_HE = [
  "",
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
];

export function AssessmentsMonthView({ month, year }: AssessmentsMonthViewProps) {
  const [search, setSearch] = useQueryState("q", parseAsString.withDefault(""));
  const [ageGroup, setAgeGroup] = useQueryState(
    "age",
    parseAsString.withDefault("all")
  );
  const [astatus, setAstatus] = useQueryState(
    "astatus",
    parseAsString.withDefault("all")
  );

  const [page, setPage] = useState(0);
  const [data, setData] = useState<AssessmentMonthResult | null>(null);
  const [isPending, startTransition] = useTransition();

  // For the detail dialog
  const [dialogProfile, setDialogProfile] = useState<Profile | null>(null);
  const [dialogAssessment, setDialogAssessment] =
    useState<PlayerAssessment | null>(null);
  const [dialogSections, setDialogSections] = useState<
    ReturnType<typeof computeSectionCompleteness>
  >([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchData = useCallback(
    (currentPage: number) => {
      startTransition(async () => {
        const result = await getAssessmentsByMonth({
          month,
          year,
          search: search || undefined,
          ageGroupId: ageGroup !== "all" ? ageGroup : undefined,
          statusFilter: (astatus as AssessmentMonthStatus | "all") || "all",
          page: currentPage,
          pageSize: PAGE_SIZE,
        });

        if (result.error) {
          toast.error("שגיאה בטעינת נתונים");
          return; // retain stale data
        }
        setData(result);
      });
    },
    [month, year, search, ageGroup, astatus]
  );

  // Fetch on mount and when month/year/filters/page change
  useEffect(() => {
    fetchData(page);
  }, [fetchData, page]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleStatusCardClick = (status: AssessmentMonthStatus) => {
    const current = astatus || "all";
    void setAstatus(current === status ? null : status);
    setPage(0);
  };

  const handleSearchChange = (v: string | null) => {
    void setSearch(v || null);
    setPage(0);
  };

  const handleAgeGroupChange = (v: string) => {
    void setAgeGroup(v === "all" ? null : v);
    setPage(0);
  };

  const handleStatusPillClick = (value: string) => {
    void setAstatus(value === "all" ? null : value);
    setPage(0);
  };

  const handleOpenDialog = (
    profile: Profile,
    assessment: PlayerAssessment
  ) => {
    const sections = data?.sectionsByUser[profile.id] ?? [];
    setDialogProfile(profile);
    setDialogAssessment(assessment);
    setDialogSections(sections);
    setDialogOpen(true);
  };

  const activeStatus = astatus || "all";
  const monthLabel = `${MONTHS_HE[month]} ${year}`;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card
          className={`cursor-pointer transition-colors ${
            activeStatus === "full"
              ? "border-primary ring-1 ring-primary"
              : "hover:border-primary/50"
          }`}
          onClick={() => handleStatusCardClick("full")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700">
              מבדק מלא
            </CardTitle>
            <ClipboardCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.fullCount ?? "—"}</div>
            <p className="text-xs text-muted-foreground">{monthLabel}</p>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-colors ${
            activeStatus === "partial"
              ? "border-amber-500 ring-1 ring-amber-500"
              : "hover:border-amber-300"
          }`}
          onClick={() => handleStatusCardClick("partial")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-amber-700">
              מבדק חלקי
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.partialCount ?? "—"}
            </div>
            <p className="text-xs text-muted-foreground">{monthLabel}</p>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-colors ${
            activeStatus === "none"
              ? "border-destructive ring-1 ring-destructive"
              : "hover:border-destructive/30"
          }`}
          onClick={() => handleStatusCardClick("none")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              ללא מבדק
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.noneCount ?? "—"}</div>
            <p className="text-xs text-muted-foreground">{monthLabel}</p>
          </CardContent>
        </Card>
      </div>

      {/* Table Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>שחקנים — {monthLabel}</CardTitle>
            {isPending && (
              <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Toolbar */}
          <TableToolbar
            searchValue={search}
            onSearchChange={handleSearchChange}
            searchPlaceholder="חיפוש לפי שם..."
            filters={
              <ToolbarSelect
                value={ageGroup || "all"}
                onValueChange={handleAgeGroupChange}
                options={ageGroupOptions}
                placeholder="קבוצת גיל"
              />
            }
          />

          {/* Status filter pills */}
          <div className="flex gap-2 flex-wrap">
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleStatusPillClick(opt.value)}
                className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                  activeStatus === opt.value
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "border-border hover:border-primary/50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Table — desktop */}
          {data && data.profiles.length > 0 ? (
            <>
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>שם</TableHead>
                      <TableHead>קבוצת גיל</TableHead>
                      <TableHead>סטטוס</TableHead>
                      <TableHead>שלמות</TableHead>
                      <TableHead>פעולות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.profiles.map((profile) => {
                      const status = data.statusByUser[profile.id];
                      const assessment = data.assessmentByUser[profile.id];
                      const sections = data.sectionsByUser[profile.id] ?? [];
                      const group = getAgeGroup(profile.birthdate);
                      const completeness = assessment
                        ? getAssessmentCompleteness(assessment)
                        : null;

                      return (
                        <TableRow key={profile.id}>
                          <TableCell className="font-medium">
                            {profile.full_name || "ללא שם"}
                          </TableCell>
                          <TableCell>
                            {group ? (
                              <Badge variant="outline">{group.label}</Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">
                                לא הוגדר
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <AssessmentStatusBadge status={status} />
                          </TableCell>
                          <TableCell>
                            {status === "partial" && assessment ? (
                              <AssessmentSectionPopover sections={sections}>
                                <button className="cursor-pointer">
                                  <Badge
                                    variant="secondary"
                                    className="bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200"
                                  >
                                    {completeness}%
                                  </Badge>
                                </button>
                              </AssessmentSectionPopover>
                            ) : status === "full" ? (
                              <Badge>100%</Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">
                                —
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {status === "full" && (
                                <Button asChild size="sm" variant="outline">
                                  <Link
                                    href={`/admin/assessments/${profile.id}`}
                                  >
                                    צפייה
                                  </Link>
                                </Button>
                              )}
                              {status === "partial" && assessment && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      handleOpenDialog(profile, assessment)
                                    }
                                  >
                                    פרטים
                                  </Button>
                                  <Button asChild size="sm">
                                    <Link
                                      href={`/admin/assessments/${profile.id}/${assessment.id}/edit`}
                                    >
                                      השלם מבדק
                                    </Link>
                                  </Button>
                                </>
                              )}
                              {status === "none" && (
                                <Button asChild size="sm">
                                  <Link
                                    href={`/admin/assessments/${profile.id}/new`}
                                  >
                                    + מבדק חדש
                                  </Link>
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile card list */}
              <div className="space-y-2 sm:hidden">
                {data.profiles.map((profile) => {
                  const status = data.statusByUser[profile.id];
                  const assessment = data.assessmentByUser[profile.id];
                  const group = getAgeGroup(profile.birthdate);
                  const completeness = assessment
                    ? getAssessmentCompleteness(assessment)
                    : null;

                  return (
                    <div
                      key={profile.id}
                      className="p-3 rounded-lg border space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">
                          {profile.full_name || "ללא שם"}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {group && (
                            <Badge variant="outline" className="text-xs">
                              {group.label}
                            </Badge>
                          )}
                          <AssessmentStatusBadge status={status} />
                        </div>
                      </div>
                      {status === "partial" && completeness !== null && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>שלמות: {completeness}%</span>
                        </div>
                      )}
                      <div className="flex gap-2">
                        {status === "full" && (
                          <Button
                            asChild
                            size="sm"
                            variant="outline"
                            className="flex-1"
                          >
                            <Link href={`/admin/assessments/${profile.id}`}>
                              צפייה
                            </Link>
                          </Button>
                        )}
                        {status === "partial" && assessment && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={() =>
                                handleOpenDialog(profile, assessment)
                              }
                            >
                              פרטים
                            </Button>
                            <Button asChild size="sm" className="flex-1">
                              <Link
                                href={`/admin/assessments/${profile.id}/${assessment.id}/edit`}
                              >
                                השלם
                              </Link>
                            </Button>
                          </>
                        )}
                        {status === "none" && (
                          <Button asChild size="sm" className="flex-1">
                            <Link
                              href={`/admin/assessments/${profile.id}/new`}
                            >
                              + מבדק חדש
                            </Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <SimpleTablePagination
                totalItems={data.total}
                pageSize={PAGE_SIZE}
                currentPage={page}
                onPageChange={handlePageChange}
                itemLabel="שחקנים"
              />
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {isPending ? "טוען..." : "לא נמצאו שחקנים"}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      {dialogProfile && dialogAssessment && (
        <AssessmentDetailDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          profile={dialogProfile}
          assessment={dialogAssessment}
          sections={dialogSections}
        />
      )}
    </div>
  );
}
