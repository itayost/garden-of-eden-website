"use client";

import { useState, useTransition, useCallback, useRef } from "react";
import { useQueryState, parseAsString } from "nuqs";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, RefreshCw } from "lucide-react";
import { TableToolbar, ToolbarSelect } from "@/components/admin/TableToolbar";
import { MonthPicker } from "@/components/admin/assessments/MonthPicker";
import { SimpleTablePagination } from "@/components/admin/TablePagination";
import {
  AGE_GROUPS,
  ASSESSMENT_SECTIONS,
  getAgeGroup,
  getAssessmentCompleteness,
} from "@/types/assessment";
import type { AssessmentSectionKey, PlayerAssessment } from "@/types/assessment";
import type { Profile } from "@/types/database";
import { getAssessmentsPaginated } from "@/lib/actions/admin-assessments-list";
import { positionFilterOptions, POSITION_FILTER_ALL } from "@/lib/admin/position-filter";

interface AssessmentsTableProps {
  initialProfiles: Profile[];
  initialAssessmentsByUser: Record<string, PlayerAssessment[]>;
  initialTotal: number;
}

const PAGE_SIZE = 20;

const ageGroupOptions = [
  { value: "all", label: "כל קבוצות הגיל" },
  ...AGE_GROUPS.map((g) => ({ value: g.id, label: g.labelHe })),
];

const TEST_FILTER_ALL = "all";
const testFilterOptions = [
  { value: TEST_FILTER_ALL, label: "כל המבדקים" },
  ...ASSESSMENT_SECTIONS.map((s) => ({ value: s.key, label: s.title })),
];

const ASSESSMENT_SECTION_KEYS = new Set<string>(
  ASSESSMENT_SECTIONS.map((s) => s.key),
);

function asSectionKey(value: string): AssessmentSectionKey | undefined {
  return ASSESSMENT_SECTION_KEYS.has(value)
    ? (value as AssessmentSectionKey)
    : undefined;
}

interface FilterValues {
  page: number;
  search: string;
  ageGroup: string;
  position: string;
  test: string;
}

export function AssessmentsTable({
  initialProfiles,
  initialAssessmentsByUser,
  initialTotal,
}: AssessmentsTableProps) {
  const [profiles, setProfiles] = useState(initialProfiles);
  const [assessmentsByUser, setAssessmentsByUser] = useState(initialAssessmentsByUser);
  const [total, setTotal] = useState(initialTotal);
  const [search, setSearch] = useQueryState("q", parseAsString.withDefault(""));
  const [ageGroup, setAgeGroup] = useQueryState("age", parseAsString.withDefault("all"));
  const [position, setPosition] = useQueryState(
    "position",
    parseAsString.withDefault(POSITION_FILTER_ALL),
  );
  const [test, setTest] = useQueryState(
    "test",
    parseAsString.withDefault(TEST_FILTER_ALL),
  );
  const [page, setPage] = useState(0);
  const [isPending, startTransition] = useTransition();
  const requestIdRef = useRef(0);

  const currentFilters: FilterValues = {
    page,
    search,
    ageGroup,
    position,
    test,
  };

  const fetchData = useCallback((filters: FilterValues) => {
    const currentRequestId = ++requestIdRef.current;
    startTransition(async () => {
      const result = await getAssessmentsPaginated({
        page: filters.page,
        pageSize: PAGE_SIZE,
        search: filters.search || undefined,
        ageGroupId: filters.ageGroup !== "all" ? filters.ageGroup : undefined,
        position:
          filters.position !== POSITION_FILTER_ALL ? filters.position : undefined,
        test: filters.test !== TEST_FILTER_ALL ? asSectionKey(filters.test) : undefined,
      });
      if (currentRequestId === requestIdRef.current) {
        setProfiles(result.profiles);
        setAssessmentsByUser(result.assessmentsByUser);
        setTotal(result.total);
      }
    });
  }, []);

  const handleSearchChange = (value: string) => {
    setSearch(value || null);
    setPage(0);
    fetchData({ ...currentFilters, page: 0, search: value });
  };

  const handleAgeGroupChange = (value: string) => {
    setAgeGroup(value === "all" ? null : value);
    setPage(0);
    fetchData({ ...currentFilters, page: 0, ageGroup: value });
  };

  const handlePositionChange = (value: string) => {
    setPosition(value === POSITION_FILTER_ALL ? null : value);
    setPage(0);
    fetchData({ ...currentFilters, page: 0, position: value });
  };

  const handleTestChange = (value: string) => {
    setTest(value === TEST_FILTER_ALL ? null : value);
    setPage(0);
    fetchData({ ...currentFilters, page: 0, test: value });
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchData({ ...currentFilters, page: newPage });
  };

  return (
    <div className="space-y-4">
      <TableToolbar
        searchValue={search}
        onSearchChange={handleSearchChange}
        searchPlaceholder="חיפוש לפי שם..."
        filters={
          <>
            <ToolbarSelect
              value={ageGroup || "all"}
              onValueChange={handleAgeGroupChange}
              options={ageGroupOptions}
              placeholder="קבוצת גיל"
            />
            <ToolbarSelect
              value={position || POSITION_FILTER_ALL}
              onValueChange={handlePositionChange}
              options={positionFilterOptions}
              placeholder="עמדה"
            />
            <ToolbarSelect
              value={test || TEST_FILTER_ALL}
              onValueChange={handleTestChange}
              options={testFilterOptions}
              placeholder="מבדק"
            />
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            <MonthPicker />
            {isPending && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />}
          </div>
        }
      />

      {profiles.length > 0 ? (
        <>
          {/* Mobile: Card list */}
          <div className="space-y-2 sm:hidden">
            {profiles.map((profile) => {
              const userAssessments = assessmentsByUser[profile.id] || [];
              const latestAssessment = userAssessments[0];
              const group = getAgeGroup(profile.birthdate);
              const completeness = latestAssessment
                ? getAssessmentCompleteness(latestAssessment)
                : 0;

              return (
                <div key={profile.id} className="p-3 rounded-lg border space-y-2">
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
                      <Badge variant="secondary" className="text-xs">
                        {userAssessments.length} מבדקים
                      </Badge>
                    </div>
                  </div>
                  {latestAssessment && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        אחרון:{" "}
                        {new Date(
                          latestAssessment.assessment_date
                        ).toLocaleDateString("he-IL")}
                      </span>
                      <Badge
                        variant={
                          completeness >= 80
                            ? "default"
                            : completeness >= 50
                              ? "secondary"
                              : "outline"
                        }
                        className="text-xs"
                      >
                        {completeness}%
                      </Badge>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button asChild size="sm" variant="outline" className="flex-1">
                      <Link href={`/admin/assessments/${profile.id}`}>
                        צפייה
                      </Link>
                    </Button>
                    {latestAssessment && completeness < 100 ? (
                      <Button asChild size="sm" className="flex-1">
                        <Link
                          href={`/admin/assessments/${profile.id}/${latestAssessment.id}/edit`}
                        >
                          <Pencil className="h-4 w-4 ml-1" />
                          השלם מבדק
                        </Link>
                      </Button>
                    ) : (
                      <Button asChild size="sm" className="flex-1">
                        <Link href={`/admin/assessments/${profile.id}/new`}>
                          <Plus className="h-4 w-4 ml-1" />
                          מבדק חדש
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop: Table */}
          <div className="hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>שם</TableHead>
                  <TableHead>קבוצת גיל</TableHead>
                  <TableHead>מבדקים</TableHead>
                  <TableHead>מבדק אחרון</TableHead>
                  <TableHead>שלמות</TableHead>
                  <TableHead>פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((profile) => {
                  const userAssessments = assessmentsByUser[profile.id] || [];
                  const latestAssessment = userAssessments[0];
                  const group = getAgeGroup(profile.birthdate);
                  const completeness = latestAssessment
                    ? getAssessmentCompleteness(latestAssessment)
                    : 0;

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
                        <Badge variant="secondary">
                          {userAssessments.length}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {latestAssessment ? (
                          <span className="text-sm">
                            {new Date(
                              latestAssessment.assessment_date
                            ).toLocaleDateString("he-IL")}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            ---
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {latestAssessment ? (
                          <Badge
                            variant={
                              completeness >= 80
                                ? "default"
                                : completeness >= 50
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            {completeness}%
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            ---
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/admin/assessments/${profile.id}`}>
                              צפייה
                            </Link>
                          </Button>
                          {latestAssessment && completeness < 100 ? (
                            <Button asChild size="sm">
                              <Link
                                href={`/admin/assessments/${profile.id}/${latestAssessment.id}/edit`}
                              >
                                <Pencil className="h-4 w-4 ml-1" />
                                השלם מבדק
                              </Link>
                            </Button>
                          ) : (
                            <Button asChild size="sm">
                              <Link
                                href={`/admin/assessments/${profile.id}/new`}
                              >
                                <Plus className="h-4 w-4 ml-1" />
                                מבדק חדש
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

          <SimpleTablePagination
            totalItems={total}
            pageSize={PAGE_SIZE}
            currentPage={page}
            onPageChange={handlePageChange}
            itemLabel="שחקנים"
          />
        </>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          {search ||
          (ageGroup && ageGroup !== "all") ||
          (position && position !== POSITION_FILTER_ALL) ||
          (test && test !== TEST_FILTER_ALL)
            ? "לא נמצאו שחקנים מתאימים"
            : "אין שחקנים רשומים"}
        </div>
      )}
    </div>
  );
}
