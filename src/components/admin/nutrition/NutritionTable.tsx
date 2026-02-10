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
import { Edit } from "lucide-react";
import { TableToolbar, ToolbarSelect } from "@/components/admin/TableToolbar";
import { SimpleTablePagination } from "@/components/admin/TablePagination";

interface Trainee {
  id: string;
  full_name: string | null;
}

interface NutritionTableProps {
  trainees: Trainee[];
  mealPlanUserIds: string[];
  recommendationUserIds: string[];
}

const PAGE_SIZE = 20;

const planFilterOptions = [
  { value: "all", label: "כולם" },
  { value: "has_plan", label: "יש תוכנית" },
  { value: "no_plan", label: "אין תוכנית" },
];

const recFilterOptions = [
  { value: "all", label: "כולם" },
  { value: "has_rec", label: "יש המלצות" },
  { value: "no_rec", label: "אין המלצות" },
];

export function NutritionTable({
  trainees,
  mealPlanUserIds,
  recommendationUserIds,
}: NutritionTableProps) {
  const [search, setSearch] = useQueryState("q", parseAsString.withDefault(""));
  const [planFilter, setPlanFilter] = useQueryState("plan", parseAsString.withDefault("all"));
  const [recFilter, setRecFilter] = useQueryState("rec", parseAsString.withDefault("all"));

  const mealPlanSet = useMemo(() => new Set(mealPlanUserIds), [mealPlanUserIds]);
  const recSet = useMemo(() => new Set(recommendationUserIds), [recommendationUserIds]);

  const filteredTrainees = useMemo(() => {
    return trainees.filter((trainee) => {
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        if (!trainee.full_name?.toLowerCase().includes(searchLower)) return false;
      }

      // Meal plan filter
      if (planFilter && planFilter !== "all") {
        const hasPlan = mealPlanSet.has(trainee.id);
        if (planFilter === "has_plan" && !hasPlan) return false;
        if (planFilter === "no_plan" && hasPlan) return false;
      }

      // Recommendations filter
      if (recFilter && recFilter !== "all") {
        const hasRec = recSet.has(trainee.id);
        if (recFilter === "has_rec" && !hasRec) return false;
        if (recFilter === "no_rec" && hasRec) return false;
      }

      return true;
    });
  }, [trainees, search, planFilter, recFilter, mealPlanSet, recSet]);

  const [page, setPage] = useState(0);

  const paginatedTrainees = useMemo(
    () => filteredTrainees.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filteredTrainees, page]
  );

  const handleSearchChange = (value: string) => {
    setSearch(value || null);
    setPage(0);
  };

  const handlePlanFilterChange = (value: string) => {
    setPlanFilter(value === "all" ? null : value);
    setPage(0);
  };

  const handleRecFilterChange = (value: string) => {
    setRecFilter(value === "all" ? null : value);
    setPage(0);
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
              value={planFilter || "all"}
              onValueChange={handlePlanFilterChange}
              options={planFilterOptions}
              placeholder="תוכנית תזונה"
            />
            <ToolbarSelect
              value={recFilter || "all"}
              onValueChange={handleRecFilterChange}
              options={recFilterOptions}
              placeholder="המלצות"
            />
          </>
        }
      />

      {filteredTrainees.length > 0 ? (
        <>
          {/* Mobile: Card list */}
          <div className="space-y-2 sm:hidden">
            {paginatedTrainees.map((trainee) => {
              const hasMealPlan = mealPlanSet.has(trainee.id);
              const hasRecommendation = recSet.has(trainee.id);

              return (
                <div
                  key={trainee.id}
                  className="flex items-center gap-3 p-3 rounded-lg border"
                >
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-sm truncate block">
                      {trainee.full_name || "ללא שם"}
                    </span>
                    <div className="flex items-center gap-1.5 mt-1">
                      {hasMealPlan ? (
                        <Badge variant="default" className="bg-green-600 text-xs">
                          תזונה
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          אין תזונה
                        </Badge>
                      )}
                      {hasRecommendation ? (
                        <Badge variant="default" className="bg-blue-600 text-xs">
                          המלצות
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          אין המלצות
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button asChild size="sm" className="shrink-0">
                    <Link href={`/admin/nutrition/${trainee.id}`}>
                      <Edit className="h-4 w-4 ml-1" />
                      ניהול
                    </Link>
                  </Button>
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
                  <TableHead>תוכנית תזונה</TableHead>
                  <TableHead>המלצות</TableHead>
                  <TableHead>פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTrainees.map((trainee) => {
                  const hasMealPlan = mealPlanSet.has(trainee.id);
                  const hasRecommendation = recSet.has(trainee.id);

                  return (
                    <TableRow key={trainee.id}>
                      <TableCell className="font-medium">
                        {trainee.full_name || "ללא שם"}
                      </TableCell>
                      <TableCell>
                        {hasMealPlan ? (
                          <Badge variant="default" className="bg-green-600">
                            קיימת
                          </Badge>
                        ) : (
                          <Badge variant="outline">אין</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {hasRecommendation ? (
                          <Badge variant="default" className="bg-blue-600">
                            קיימות
                          </Badge>
                        ) : (
                          <Badge variant="outline">אין</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button asChild size="sm">
                          <Link href={`/admin/nutrition/${trainee.id}`}>
                            <Edit className="h-4 w-4 ml-1" />
                            ניהול
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <SimpleTablePagination
            totalItems={filteredTrainees.length}
            pageSize={PAGE_SIZE}
            currentPage={page}
            onPageChange={setPage}
            itemLabel="חניכים"
          />
        </>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          {search || (planFilter && planFilter !== "all") || (recFilter && recFilter !== "all")
            ? "לא נמצאו חניכים מתאימים"
            : "אין חניכים רשומים"}
        </div>
      )}
    </div>
  );
}
