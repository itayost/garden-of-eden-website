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
import type { Equipment } from "@/types/equipment";
import { EquipmentFormDialog } from "./EquipmentFormDialog";

interface EquipmentManagerProps {
  equipment: Equipment[];
  loadError: string | null;
  isAdmin: boolean;
}

/**
 * The equipment catalog. Each item's QR sticker encodes
 * /dashboard/scan/<code>; the printable sheet lives at
 * /admin/workouts/equipment/print.
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

      <Card>
        <CardContent>
          {equipment.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">
              אין ציוד בקטלוג עדיין{isAdmin ? " — הוסף את המכשיר הראשון." : "."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>שם</TableHead>
                  <TableHead>קוד</TableHead>
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
