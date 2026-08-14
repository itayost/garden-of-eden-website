"use client";

import { useState, useTransition, useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Pencil, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { DeleteConfirmDialog } from "@/components/admin/DeleteConfirmDialog";
import { ExerciseForm } from "@/features/workouts/components/ExerciseForm";
import {
  listExercises,
  listSubCategories,
  deleteExercise,
} from "@/features/workouts/lib/actions";
import {
  MAIN_CATEGORIES,
  UNLINKED_EQUIPMENT_FILTER,
} from "@/features/workouts/lib/types";
import type { WorkoutExercise } from "@/features/workouts/lib/types";
import { listEquipmentAction } from "@/lib/actions/equipment";
import type { Equipment } from "@/types/equipment";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;

const ALL_MAIN_CATEGORIES_OPTION = { value: "__all__", label: "כל הקטגוריות" };
const ALL_SUB_CATEGORIES_OPTION = { value: "__all__", label: "כל תת-קטגוריות" };
const ALL_EQUIPMENT_OPTION = { value: "__all__", label: "כל הציוד" };
const UNLINKED_EQUIPMENT_OPTION = {
  value: UNLINKED_EQUIPMENT_FILTER,
  label: "ללא ציוד מקושר",
};

// ---------------------------------------------------------------------------
// ExerciseTable
// ---------------------------------------------------------------------------

export function ExerciseTable() {
  const searchParams = useSearchParams();

  // Filter & pagination state
  const [mainCategory, setMainCategory] = useState<string>("");
  const [subCategory, setSubCategory] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  // Seeded from ?equipment=<id>, which is where the count badge on the
  // equipment catalog links to.
  const [equipmentId, setEquipmentId] = useState<string>(
    () => searchParams.get("equipment") ?? "",
  );
  const [page, setPage] = useState<number>(0);
  const [equipmentOptions, setEquipmentOptions] = useState<Equipment[]>([]);

  // Data state
  const [rows, setRows] = useState<WorkoutExercise[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, startTransition] = useTransition();
  const [subCategories, setSubCategories] = useState<string[]>([]);

  // Dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<WorkoutExercise | undefined>(undefined);

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  const load = useCallback(() => {
    startTransition(async () => {
      const result = await listExercises(
        {
          mainCategory: mainCategory || undefined,
          subCategory: subCategory || undefined,
          search: search || undefined,
          equipmentId: equipmentId || undefined,
        },
        page
      );
      setRows(result.rows);
      setTotal(result.total);
    });
  }, [mainCategory, subCategory, search, equipmentId, page]);

  useEffect(() => {
    load();
  }, [load]);

  // Load sub-categories from the full corpus whenever main category changes
  useEffect(() => {
    let cancelled = false;
    listSubCategories(mainCategory || undefined).then((result) => {
      if (!cancelled) setSubCategories(result);
    });
    return () => {
      cancelled = true;
    };
  }, [mainCategory]);

  // ---------------------------------------------------------------------------
  // Filter change handlers — reset to page 0
  // ---------------------------------------------------------------------------

  const handleMainCategoryChange = (val: string) => {
    setMainCategory(val === "__all__" ? "" : val);
    setSubCategory("");
    setPage(0);
  };

  const handleSubCategoryChange = (val: string) => {
    setSubCategory(val === "__all__" ? "" : val);
    setPage(0);
  };

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(0);
  };

  // ---------------------------------------------------------------------------
  // Sub-categories loaded from the full corpus via listSubCategories
  // ---------------------------------------------------------------------------

  const subCategoryOptions = [
    ALL_SUB_CATEGORIES_OPTION,
    ...subCategories.map((s) => ({ value: s, label: s })),
  ];

  const mainCategoryOptions = [
    ALL_MAIN_CATEGORIES_OPTION,
    ...MAIN_CATEGORIES.map((c) => ({ value: c, label: c })),
  ];

  const equipmentOptionsList = useMemo(
    () => [
      ALL_EQUIPMENT_OPTION,
      UNLINKED_EQUIPMENT_OPTION,
      ...equipmentOptions.map((item) => ({
        value: item.id,
        label: item.is_active ? item.name_he : `${item.name_he} (לא פעיל)`,
      })),
    ],
    [equipmentOptions],
  );

  const handleEquipmentChange = (value: string) => {
    setEquipmentId(value === "__all__" ? "" : value);
    setPage(0);
  };

  // The catalog powers the equipment filter. Loaded once — it is a few dozen
  // rows and does not change while the table is open.
  useEffect(() => {
    let cancelled = false;
    listEquipmentAction().then((result) => {
      if (!cancelled && "success" in result) setEquipmentOptions(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Form dialog handlers
  // ---------------------------------------------------------------------------

  const openCreate = () => {
    setEditTarget(undefined);
    setFormOpen(true);
  };

  const openEdit = (exercise: WorkoutExercise) => {
    setEditTarget(exercise);
    setFormOpen(true);
  };

  const handleFormSaved = () => {
    setFormOpen(false);
    load();
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <TableToolbar
        searchValue={search}
        onSearchChange={handleSearchChange}
        searchPlaceholder="חיפוש לפי שם או מכשיר..."
        filters={
          <>
            <ToolbarSelect
              value={mainCategory || "__all__"}
              onValueChange={handleMainCategoryChange}
              options={mainCategoryOptions}
              placeholder="קטגוריה ראשית"
            />
            <ToolbarSelect
              value={subCategory || "__all__"}
              onValueChange={handleSubCategoryChange}
              options={subCategoryOptions}
              placeholder="תת-קטגוריה"
            />
            <ToolbarSelect
              value={equipmentId || "__all__"}
              onValueChange={handleEquipmentChange}
              options={equipmentOptionsList}
              placeholder="ציוד"
            />
          </>
        }
        actions={
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4 ms-2" />
            תרגיל חדש
          </Button>
        }
      />

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>שם עברית</TableHead>
              <TableHead>שם אנגלית</TableHead>
              <TableHead>קטגוריה</TableHead>
              <TableHead>תת-קטגוריה</TableHead>
              <TableHead>ציוד</TableHead>
              <TableHead className="w-24">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  טוען...
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  לא נמצאו תרגילים
                </TableCell>
              </TableRow>
            ) : (
              rows.map((exercise) => (
                <ExerciseRow
                  key={exercise.id}
                  exercise={exercise}
                  onEdit={openEdit}
                  onDeleted={() => {
                    load();
                  }}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <SimpleTablePagination
        totalItems={total}
        pageSize={PAGE_SIZE}
        currentPage={page}
        onPageChange={setPage}
        itemLabel="תרגילים"
      />

      {/* Create / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={(v) => !v && setFormOpen(false)}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editTarget ? "עריכת תרגיל" : "תרגיל חדש"}
            </DialogTitle>
          </DialogHeader>
          <ExerciseForm
            key={editTarget?.id ?? "new"}
            exercise={editTarget}
            equipmentOptions={equipmentOptions}
            onSaved={handleFormSaved}
            onCancel={() => setFormOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ExerciseRow — extracted to keep the main component focused
// ---------------------------------------------------------------------------

interface ExerciseRowProps {
  exercise: WorkoutExercise;
  onEdit: (exercise: WorkoutExercise) => void;
  onDeleted: () => void;
}

function ExerciseRow({ exercise, onEdit, onDeleted }: ExerciseRowProps) {
  return (
    <TableRow>
      <TableCell className="font-medium">
        {exercise.nameHe ?? <span className="text-muted-foreground text-xs">—</span>}
      </TableCell>
      <TableCell dir="ltr" className="text-start">
        {exercise.nameEn ?? <span className="text-muted-foreground text-xs">—</span>}
      </TableCell>
      <TableCell>{exercise.mainCategory}</TableCell>
      <TableCell>
        {exercise.subCategory ?? <span className="text-muted-foreground text-xs">—</span>}
      </TableCell>
      <TableCell>
        <EquipmentCell exercise={exercise} />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(exercise)}
            aria-label="ערוך תרגיל"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <DeleteConfirmDialog
            title={`מחיקת תרגיל: ${exercise.nameHe ?? exercise.nameEn ?? "ללא שם"}`}
            description="פעולה זו תמחק את התרגיל לצמיתות ולא ניתן לשחזרו."
            successMessage="תרגיל נמחק"
            errorMessage="שגיאה במחיקת תרגיל"
            onDelete={() => deleteExercise(exercise.id)}
            onSuccess={onDeleted}
            trigger={
              <Button variant="ghost" size="icon" aria-label="מחק תרגיל">
                <span className="text-destructive text-sm">מחק</span>
              </Button>
            }
          />
        </div>
      </TableCell>
    </TableRow>
  );
}

// ---------------------------------------------------------------------------
// EquipmentCell
//
// Shows the LINKED CATALOG MACHINE, not the legacy free-text `equipment`
// column. Those two disagreeing is why the connection looked absent: a fully
// scannable exercise rendered an em dash, while "משקל חופשי" typed into the
// text field looked connected and could never match a QR.
// ---------------------------------------------------------------------------

function EquipmentCell({ exercise }: { exercise: WorkoutExercise }) {
  if (exercise.equipmentId && exercise.equipmentName) {
    return (
      <span className="flex flex-col gap-0.5">
        <span className="flex items-center gap-1.5 font-medium">
          <QrCode className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          {exercise.equipmentName}
        </span>
        {exercise.equipmentCode && (
          <span dir="ltr" className="text-start font-mono text-[10px] text-muted-foreground">
            {exercise.equipmentCode}
          </span>
        )}
      </span>
    );
  }

  return (
    <span className="flex flex-col gap-0.5">
      <span className="w-fit rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
        לא מקושר לציוד
      </span>
      {exercise.equipment && (
        <span className="text-[10px] text-muted-foreground">
          {exercise.equipment}
        </span>
      )}
    </span>
  );
}
