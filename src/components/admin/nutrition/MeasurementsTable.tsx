"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { UserRole } from "@/types/database";
import type { NutritionMeasurementRow } from "@/features/nutrition/types";
import { MEASUREMENT_UNITS } from "@/features/nutrition/types";
import { softDeleteMeasurement } from "@/features/nutrition/lib/actions/soft-delete-measurement";
import { formatDateShort } from "@/lib/utils/date";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { DeleteConfirmDialog } from "@/components/admin/DeleteConfirmDialog";
import { MeasurementForm } from "./MeasurementForm";

interface MeasurementsTableProps {
  userId: string;
  measurements: NutritionMeasurementRow[];
  dateOfBirth: string | null;
  currentUserRole: UserRole;
}

function formatNumber(value: number | null, decimals: number, unit?: string): string {
  if (value === null || value === undefined) return "—";
  const text = value.toFixed(decimals);
  return unit ? `${text} ${unit}` : text;
}

export function MeasurementsTable({
  userId,
  measurements,
  dateOfBirth,
  currentUserRole,
}: MeasurementsTableProps) {
  // null = closed, "new" = add dialog, NutritionMeasurementRow = edit dialog
  const [dialogState, setDialogState] = useState<
    null | "new" | NutritionMeasurementRow
  >(null);

  const closeDialog = () => setDialogState(null);

  const editingRow = dialogState && dialogState !== "new" ? dialogState : null;
  const isAdmin = currentUserRole === "admin";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {measurements.length === 0
            ? "טרם נרשמו מדידות"
            : `${measurements.length} מדידות`}
        </p>
        <Button size="sm" onClick={() => setDialogState("new")}>
          <Plus className="ml-2 h-4 w-4" />
          הוסף מדידה
        </Button>
      </div>

      {measurements.length > 0 && (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>תאריך</TableHead>
                <TableHead>גיל</TableHead>
                <TableHead>גובה</TableHead>
                <TableHead>אחוזון גובה</TableHead>
                <TableHead>משקל</TableHead>
                <TableHead>BMI</TableHead>
                <TableHead>אחוזון BMI</TableHead>
                <TableHead>אחוז שומן</TableHead>
                <TableHead className="w-[120px]">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {measurements.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{formatDateShort(row.measurement_date)}</TableCell>
                  <TableCell>{row.age ?? "—"}</TableCell>
                  <TableCell>
                    {formatNumber(row.height_cm, 1, MEASUREMENT_UNITS.height_cm)}
                  </TableCell>
                  <TableCell>
                    {formatNumber(
                      row.height_percentile,
                      2,
                      MEASUREMENT_UNITS.height_percentile
                    )}
                  </TableCell>
                  <TableCell>
                    {formatNumber(row.weight_kg, 2, MEASUREMENT_UNITS.weight_kg)}
                  </TableCell>
                  <TableCell>{formatNumber(row.bmi, 2)}</TableCell>
                  <TableCell>
                    {formatNumber(
                      row.bmi_percentile,
                      2,
                      MEASUREMENT_UNITS.bmi_percentile
                    )}
                  </TableCell>
                  <TableCell>
                    {formatNumber(
                      row.body_fat_percentage,
                      2,
                      MEASUREMENT_UNITS.body_fat_percentage
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setDialogState(row)}
                        aria-label="ערוך מדידה"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {isAdmin && (
                        <DeleteConfirmDialog
                          title="מחיקת מדידה"
                          description={`למחוק את המדידה מתאריך ${formatDateShort(
                            row.measurement_date
                          )}? לא ניתן יהיה לשחזר.`}
                          confirmLabel="מחק"
                          loadingLabel="מוחק..."
                          successMessage="המדידה נמחקה"
                          errorMessage="שגיאה במחיקת המדידה"
                          onDelete={() => softDeleteMeasurement(row.id)}
                          trigger={
                            <Button size="icon" variant="ghost" aria-label="מחק מדידה">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          }
                        />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogState !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingRow ? "עריכת מדידה" : "מדידה חדשה"}</DialogTitle>
            <DialogDescription>
              {editingRow
                ? "עדכן את ערכי המדידה שנשמרו"
                : "מלא את נתוני המדידה. BMI יחושב אוטומטית מגובה ומשקל."}
            </DialogDescription>
          </DialogHeader>
          {/* key forces remount so RHF gets fresh defaults when switching rows */}
          <MeasurementForm
            key={editingRow ? editingRow.id : "new"}
            userId={userId}
            existing={editingRow}
            dateOfBirth={dateOfBirth}
            onSuccess={closeDialog}
            onCancel={closeDialog}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
