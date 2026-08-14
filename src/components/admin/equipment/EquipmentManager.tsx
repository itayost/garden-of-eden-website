"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Printer, QrCode } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Equipment, EquipmentWithUsage } from "@/types/equipment";
import { EquipmentFormDialog } from "./EquipmentFormDialog";
import { MeasureBadges } from "./MeasureBadges";

interface EquipmentManagerProps {
  equipment: EquipmentWithUsage[];
  loadError: string | null;
  isAdmin: boolean;
}

/**
 * The equipment catalog. Each item's QR sticker encodes
 * /dashboard/scan/<code>; the printable sheet lives at
 * /print/equipment-stickers.
 *
 * The exercise count is the column worth reading: a machine linked to zero
 * exercises scans fine but can never match anything in a session, which is
 * otherwise silent.
 */
export function EquipmentManager({
  equipment,
  loadError,
  isAdmin,
}: EquipmentManagerProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Equipment | null>(null);
  const [formInstance, setFormInstance] = useState(0);

  const openCreate = () => {
    setEditTarget(null);
    setFormInstance((n) => n + 1);
    setFormOpen(true);
  };

  const openEdit = (item: Equipment) => {
    setEditTarget(item);
    setFormInstance((n) => n + 1);
    setFormOpen(true);
  };

  if (loadError) {
    return (
      <Card className="border-destructive">
        <CardContent className="py-12 text-center text-destructive">
          {loadError}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          כל מכשיר מקבל מדבקת QR שסריקתה פותחת את רישום התרגיל אצל המתאמן.
        </p>
        <div className="flex gap-2">
          {/* Conditional render, not disabled: asChild forwards disabled to
              the anchor, which ignores it. */}
          {equipment.length > 0 && (
            <Button variant="outline" asChild>
              <Link href="/print/equipment-stickers" target="_blank">
                <Printer className="me-2 h-4 w-4" />
                הדפסת מדבקות
              </Link>
            </Button>
          )}
          {isAdmin && (
            <Button onClick={openCreate}>
              <Plus className="me-2 h-4 w-4" />
              ציוד חדש
            </Button>
          )}
        </div>
      </div>

      {/* Mobile: card list — the table cramps below ~400px. */}
      {equipment.length > 0 && (
        <div className="space-y-2 md:hidden">
          {equipment.map((item) => (
            <Card key={item.id} className="rounded-2xl py-0">
              <CardContent className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-bold">
                    <QrCode className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{item.name_he}</span>
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                    {item.code}
                  </p>
                  <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <MeasureBadges measures={item} />
                    <ExerciseCount item={item} />
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={item.is_active ? "default" : "secondary"}>
                    {item.is_active ? "פעיל" : "לא פעיל"}
                  </Badge>
                  {isAdmin && (
                    <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>
                      עריכה
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className={equipment.length > 0 ? "hidden md:block" : undefined}>
        <CardContent>
          {equipment.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <span className="rounded-full bg-muted p-3">
                <QrCode className="h-6 w-6 text-muted-foreground" />
              </span>
              <p className="text-muted-foreground">
                אין ציוד בקטלוג עדיין{isAdmin ? " — הוסף את המכשיר הראשון." : "."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>שם</TableHead>
                  <TableHead>קוד</TableHead>
                  <TableHead>נמדד</TableHead>
                  <TableHead>תרגילים</TableHead>
                  <TableHead>סטטוס</TableHead>
                  <TableHead>הערות</TableHead>
                  {isAdmin && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {equipment.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2">
                        <QrCode className="h-4 w-4 text-muted-foreground" />
                        {item.name_he}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{item.code}</TableCell>
                    <TableCell>
                      <MeasureBadges measures={item} />
                    </TableCell>
                    <TableCell>
                      <ExerciseCount item={item} />
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.is_active ? "default" : "secondary"}>
                        {item.is_active ? "פעיל" : "לא פעיל"}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                      {item.notes_he ?? ""}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(item)}
                        >
                          עריכה
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {isAdmin && (
        <EquipmentFormDialog
          key={formInstance}
          open={formOpen}
          onOpenChange={setFormOpen}
          equipment={editTarget}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ExerciseCount — how many library exercises run on this machine
// ---------------------------------------------------------------------------

function ExerciseCount({ item }: { item: EquipmentWithUsage }) {
  if (item.exerciseCount === 0) {
    return (
      <Link
        href="/admin/workouts/exercises"
        className="inline-block rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-bold text-destructive hover:underline"
        title="סריקת המדבקה תעבוד, אבל היא לא תתאים לשום תרגיל באימון"
      >
        ללא תרגילים
      </Link>
    );
  }

  return (
    <Link
      href={`/admin/workouts/exercises?equipment=${item.id}`}
      className="inline-block rounded-full bg-gold/15 px-2 py-0.5 text-xs font-bold text-amber-700 hover:underline"
    >
      {item.exerciseCount} תרגילים
    </Link>
  );
}
