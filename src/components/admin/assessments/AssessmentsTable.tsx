"use client";

import { useMemo, useState } from "react";
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
import { Plus, Pencil } from "lucide-react";
import { TableToolbar, ToolbarSelect } from "@/components/admin/TableToolbar";
import { SimpleTablePagination } from "@/components/admin/TablePagination";
import { AGE_GROUPS, getAgeGroup, getAssessmentCompleteness } from "@/types/assessment";
import type { PlayerAssessment } from "@/types/assessment";
import type { Profile } from "@/types/database";

interface AssessmentsTableProps {
  profiles: Profile[];
  assessmentsByUser: Record<string, PlayerAssessment[]>;
}

const PAGE_SIZE = 20;

const ageGroupOptions = [
  { value: "all", label: "כל קבוצות הגיל" },
  ...AGE_GROUPS.map((g) => ({ value: g.id, label: g.labelHe })),
];

export function AssessmentsTable({
  profiles,
  assessmentsByUser,
}: AssessmentsTableProps) {
  const [search, setSearch] = useQueryState("q", parseAsString.withDefault(""));
  const [ageGroup, setAgeGroup] = useQueryState("age", parseAsString.withDefault("all"));

  const filteredProfiles = useMemo(() => {
    return profiles.filter((profile) => {
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        const nameMatch = profile.full_name?.toLowerCase().includes(searchLower);
        if (!nameMatch) return false;
      }

      // Age group filter
      if (ageGroup && ageGroup !== "all") {
        const group = getAgeGroup(profile.birthdate);
        if (!group || group.id !== ageGroup) return false;
      }

      return true;
    });
  }, [profiles, search, ageGroup]);

  const [page, setPage] = useState(0);

  const paginatedProfiles = useMemo(
    () => filteredProfiles.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filteredProfiles, page]
  );

  const handleSearchChange = (value: string) => {
    setSearch(value || null);
    setPage(0);
  };

  const handleAgeGroupChange = (value: string) => {
    setAgeGroup(value === "all" ? null : value);
    setPage(0);
  };

  return (
    <div className="space-y-4">
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

      {filteredProfiles.length > 0 ? (
        <>
          {/* Mobile: Card list */}
          <div className="space-y-2 sm:hidden">
            {paginatedProfiles.map((profile) => {
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
                {paginatedProfiles.map((profile) => {
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
            totalItems={filteredProfiles.length}
            pageSize={PAGE_SIZE}
            currentPage={page}
            onPageChange={setPage}
            itemLabel="שחקנים"
          />
        </>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          {search || (ageGroup && ageGroup !== "all")
            ? "לא נמצאו שחקנים מתאימים"
            : "אין שחקנים רשומים"}
        </div>
      )}
    </div>
  );
}
