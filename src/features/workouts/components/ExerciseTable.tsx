"use client";

import { useState, useTransition, useCallback, useEffect, useMemo } from "react";
import { useQueryState, parseAsInteger, parseAsString } from "nuqs";
import { Plus, Pencil, QrCode, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  bulkLinkEquipment,
  countUnlinkedExercises,
  deleteExercise,
  listExercises,
  listMainCategories,
  listSubCategories,
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

/** Bulk target meaning "clear the link" rather than "pick a machine". */
const BULK_UNLINK_VALUE = "__none__";

// ---------------------------------------------------------------------------
// ExerciseTable
// ---------------------------------------------------------------------------

export function ExerciseTable() {
  // Filters live in the URL: a filtered view is then shareable, survives back,
  // and the ?equipment= deep link from the equipment catalog is just one of them.
  const [mainCategory, setMainCategory] = useQueryState(
    "cat",
    parseAsString.withDefault(""),
  );
  const [subCategory, setSubCategory] = useQueryState(
    "sub",
    parseAsString.withDefault(""),
  );
  const [search, setSearch] = useQueryState("q", parseAsString.withDefault(""));
  const [equipmentId, setEquipmentId] = useQueryState(
    "equipment",
    parseAsString.withDefault(""),
  );
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(0));

  const [equipmentOptions, setEquipmentOptions] = useState<Equipment[]>([]);

  // Data state
  const [rows, setRows] = useState<WorkoutExercise[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, startTransition] = useTransition();
  const [subCategories, setSubCategories] = useState<string[]>([]);
  const [mainCategories, setMainCategories] =
    useState<readonly string[]>(MAIN_CATEGORIES);
  const [unlinkedCount, setUnlinkedCount] = useState(0);

  // Selection is per page: it clears whenever the visible rows change, so a
  // bulk link can only ever touch rows the admin is looking at.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkEquipmentId, setBulkEquipmentId] = useState<string>("");
  const [bulkPending, startBulkTransition] = useTransition();

  // Dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<WorkoutExercise | undefined>(undefined);

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  const refreshUnlinkedCount = useCallback(() => {
    countUnlinkedExercises().then(setUnlinkedCount);
  }, []);

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
      setSelectedIds([]);
    });
  }, [mainCategory, subCategory, search, equipmentId, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    refreshUnlinkedCount();
  }, [refreshUnlinkedCount]);

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

  // The categories in use. MAIN_CATEGORIES is only the seed for an empty library.
  useEffect(() => {
    let cancelled = false;
    listMainCategories().then((list) => {
      if (!cancelled && list.length > 0) setMainCategories(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // The catalog powers the equipment filter and the bulk link. Loaded once —
  // it is a few dozen rows and does not change while the table is open.
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

  const handleEquipmentChange = (value: string) => {
    setEquipmentId(value === "__all__" ? "" : value);
    setPage(0);
  };

  const showUnlinked = () => {
    setEquipmentId(UNLINKED_EQUIPMENT_FILTER);
    setPage(0);
  };

  // ---------------------------------------------------------------------------
  // Options
  // ---------------------------------------------------------------------------

  const subCategoryOptions = [
    ALL_SUB_CATEGORIES_OPTION,
    ...subCategories.map((s) => ({ value: s, label: s })),
  ];

  const mainCategoryOptions = [
    ALL_MAIN_CATEGORIES_OPTION,
    ...mainCategories.map((c) => ({ value: c, label: c })),
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

  // ---------------------------------------------------------------------------
  // Selection and bulk linking
  // ---------------------------------------------------------------------------

  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allPageSelected = rows.length > 0 && rows.every((row) => selected.has(row.id));

  const toggleRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const togglePage = () => {
    setSelectedIds(allPageSelected ? [] : rows.map((row) => row.id));
  };

  const handleBulkLink = () => {
    if (selectedIds.length === 0 || !bulkEquipmentId) return;
    startBulkTransition(async () => {
      const result = await bulkLinkEquipment(
        selectedIds,
        bulkEquipmentId === BULK_UNLINK_VALUE ? null : bulkEquipmentId,
      );

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success(
        bulkEquipmentId === BULK_UNLINK_VALUE
          ? `נותק הקישור מ-${result.updated} תרגילים`
          : `${result.updated} תרגילים קושרו למכשיר`,
      );
      setBulkEquipmentId("");
      load();
      refreshUnlinkedCount();
    });
  };

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
    refreshUnlinkedCount();
  };

  const handleDeleted = () => {
    load();
    refreshUnlinkedCount();
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const viewingUnlinked = equipmentId === UNLINKED_EQUIPMENT_FILTER;

  return (
    <div className="space-y-4" aria-busy={loading}>
      {/* An unlinked exercise is invisible to every QR sticker in the gym, so
          the count leads rather than hiding one row at a time. */}
      {unlinkedCount > 0 && !viewingUnlinked && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-amber-900 dark:bg-amber-950/40">
          <p>
            <span className="font-bold tabular-nums">{unlinkedCount}</span> תרגילים
            אינם מקושרים למכשיר, כך שסריקת ה-QR שלו לא תגיע אליהם.
          </p>
          <Button variant="outline" size="sm" onClick={showUnlinked}>
            הצג אותם
          </Button>
        </div>
      )}

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

      {/* Bulk bar */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/40 px-3 py-2">
          <span className="text-sm font-medium tabular-nums" aria-live="polite">
            נבחרו {selectedIds.length}
          </span>
          <Select
            value={bulkEquipmentId}
            onValueChange={setBulkEquipmentId}
            disabled={bulkPending}
          >
            <SelectTrigger className="w-48" aria-label="מכשיר לקישור">
              <SelectValue placeholder="קשר למכשיר..." />
            </SelectTrigger>
            <SelectContent>
              {equipmentOptions.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name_he}
                  {item.is_active ? "" : " (לא פעיל)"}
                </SelectItem>
              ))}
              <SelectItem value={BULK_UNLINK_VALUE}>ניתוק מהמכשיר</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={handleBulkLink}
            disabled={bulkPending || !bulkEquipmentId}
          >
            <Link2 className="h-4 w-4 ms-2" />
            החל
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
            ניקוי הבחירה
          </Button>
        </div>
      )}

      {/* Mobile: card list — six columns cannot fit a phone. */}
      <div className="space-y-2 md:hidden">
        {loading && rows.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">טוען...</p>
        ) : rows.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">לא נמצאו תרגילים</p>
        ) : (
          rows.map((exercise) => (
            <ExerciseCard
              key={exercise.id}
              exercise={exercise}
              selected={selected.has(exercise.id)}
              onToggle={() => toggleRow(exercise.id)}
              onEdit={openEdit}
              onDeleted={handleDeleted}
            />
          ))
        )}
      </div>

      {/* Desktop: table */}
      <div className="hidden rounded-md border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allPageSelected}
                  onCheckedChange={togglePage}
                  disabled={rows.length === 0}
                  aria-label="בחירת כל התרגילים בעמוד"
                />
              </TableHead>
              <TableHead>שם עברית</TableHead>
              <TableHead>שם אנגלית</TableHead>
              <TableHead>קטגוריה</TableHead>
              <TableHead>תת-קטגוריה</TableHead>
              <TableHead>ציוד</TableHead>
              <TableHead className="w-28">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  טוען...
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  לא נמצאו תרגילים
                </TableCell>
              </TableRow>
            ) : (
              rows.map((exercise) => (
                <ExerciseRow
                  key={exercise.id}
                  exercise={exercise}
                  selected={selected.has(exercise.id)}
                  onToggle={() => toggleRow(exercise.id)}
                  onEdit={openEdit}
                  onDeleted={handleDeleted}
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
// Row actions, shared by the table row and the mobile card
// ---------------------------------------------------------------------------

interface RowProps {
  exercise: WorkoutExercise;
  selected: boolean;
  onToggle: () => void;
  onEdit: (exercise: WorkoutExercise) => void;
  onDeleted: () => void;
}

function exerciseLabel(exercise: WorkoutExercise): string {
  return exercise.nameHe ?? exercise.nameEn ?? "ללא שם";
}

function RowActions({
  exercise,
  onEdit,
  onDeleted,
}: Pick<RowProps, "exercise" | "onEdit" | "onDeleted">) {
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onEdit(exercise)}
        aria-label={`עריכת ${exerciseLabel(exercise)}`}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <DeleteConfirmDialog
        title={`מחיקת תרגיל: ${exerciseLabel(exercise)}`}
        description="פעולה זו תמחק את התרגיל לצמיתות ולא ניתן לשחזרו. תרגיל שנמצא בשימוש בתבנית או באימון לא יימחק."
        successMessage="תרגיל נמחק"
        errorMessage="שגיאה במחיקת תרגיל"
        onDelete={() => deleteExercise(exercise.id)}
        onSuccess={onDeleted}
        trigger={
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            aria-label={`מחיקת ${exerciseLabel(exercise)}`}
          >
            מחק
          </Button>
        }
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ExerciseRow
// ---------------------------------------------------------------------------

function ExerciseRow({ exercise, selected, onToggle, onEdit, onDeleted }: RowProps) {
  return (
    <TableRow data-state={selected ? "selected" : undefined}>
      <TableCell>
        <Checkbox
          checked={selected}
          onCheckedChange={onToggle}
          aria-label={`בחירת ${exerciseLabel(exercise)}`}
        />
      </TableCell>
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
        <RowActions exercise={exercise} onEdit={onEdit} onDeleted={onDeleted} />
      </TableCell>
    </TableRow>
  );
}

// ---------------------------------------------------------------------------
// ExerciseCard — the phone view of the same row
// ---------------------------------------------------------------------------

function ExerciseCard({ exercise, selected, onToggle, onEdit, onDeleted }: RowProps) {
  return (
    <Card className="rounded-2xl py-0">
      <CardContent className="flex items-start gap-3 px-4 py-3">
        <Checkbox
          checked={selected}
          onCheckedChange={onToggle}
          className="mt-1"
          aria-label={`בחירת ${exerciseLabel(exercise)}`}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{exerciseLabel(exercise)}</p>
          <p className="truncate text-xs text-muted-foreground">
            {exercise.mainCategory}
            {exercise.subCategory ? ` / ${exercise.subCategory}` : ""}
          </p>
          <div className="mt-1.5 text-xs">
            <EquipmentCell exercise={exercise} />
          </div>
        </div>
        <div className="shrink-0">
          <RowActions exercise={exercise} onEdit={onEdit} onDeleted={onDeleted} />
        </div>
      </CardContent>
    </Card>
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
          <span dir="ltr" className="text-start font-mono text-[11px] text-muted-foreground">
            {exercise.equipmentCode}
          </span>
        )}
      </span>
    );
  }

  return (
    <span className="flex flex-col gap-0.5">
      <span className="w-fit rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        לא מקושר לציוד
      </span>
      {exercise.equipment && (
        <span className="text-[11px] text-muted-foreground">{exercise.equipment}</span>
      )}
    </span>
  );
}
