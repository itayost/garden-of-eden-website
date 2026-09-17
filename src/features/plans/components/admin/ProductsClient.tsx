"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Loader2, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { reorderProductsAction, updateProductAction } from "../../lib/actions/admin-products";
import type { ProductInput } from "@/lib/validations/plans-admin";
import type { PlanProduct } from "@/types/plans";

function ProductDialog({ product, onClose }: { product: PlanProduct; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<ProductInput>({
    name_he: product.name_he,
    blurb_he: product.blurb_he ?? "",
    price_ils: product.price_ils,
    sessions_total: product.sessions_total,
    duration_days: product.duration_days,
    once_per_trainee: product.once_per_trainee,
    gift_he: product.gift_he ?? "",
    is_active: product.is_active,
  });
  const set = <K extends keyof ProductInput>(key: K, value: ProductInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const save = () =>
    startTransition(async () => {
      const result = await updateProductAction(product.id, form);
      if ("error" in result) {
        const firstField = result.fieldErrors
          ? Object.values(result.fieldErrors)[0]?.[0]
          : undefined;
        toast.error(firstField ?? result.error);
        return;
      }
      toast.success("המסלול עודכן");
      router.refresh();
      onClose();
    });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>עריכת {product.name_he}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="p-name">שם</Label>
            <Input id="p-name" value={form.name_he} onChange={(e) => set("name_he", e.target.value)} disabled={pending} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="p-blurb">תיאור קצר</Label>
            <Input id="p-blurb" value={form.blurb_he ?? ""} onChange={(e) => set("blurb_he", e.target.value)} disabled={pending} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="p-price">מחיר (₪)</Label>
            <Input id="p-price" type="number" value={form.price_ils} onChange={(e) => set("price_ils", Number(e.target.value))} disabled={pending} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="p-days">משך (ימים)</Label>
            <Input id="p-days" type="number" value={form.duration_days} onChange={(e) => set("duration_days", Number(e.target.value))} disabled={pending} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="p-sessions">אימונים (ריק = לפי זמן)</Label>
            <Input
              id="p-sessions"
              type="number"
              value={form.sessions_total ?? ""}
              onChange={(e) => set("sessions_total", e.target.value === "" ? null : Number(e.target.value))}
              disabled={pending}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="p-gift">מתנה</Label>
            <Input id="p-gift" value={form.gift_he ?? ""} onChange={(e) => set("gift_he", e.target.value)} disabled={pending} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label>חד-פעמי לשחקן חדש</Label>
            <Switch checked={form.once_per_trainee} onCheckedChange={(v) => set("once_per_trainee", v)} disabled={pending} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label>מוצג להרשמה</Label>
            <Switch checked={form.is_active} onCheckedChange={(v) => set("is_active", v)} disabled={pending} />
          </div>
        </div>
        <DialogFooter className="flex-row-reverse gap-2">
          <Button onClick={save} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin ms-2" /> : null}
            שמור
          </Button>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            ביטול
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProductsClient({ initialProducts }: { initialProducts: PlanProduct[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<PlanProduct | null>(null);
  const [reordering, startReorder] = useTransition();

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= initialProducts.length) return;
    const ids = initialProducts.map((p) => p.id);
    const reordered = ids.map((id, i) => {
      if (i === index) return ids[target];
      if (i === target) return ids[index];
      return id;
    });
    startReorder(async () => {
      const result = await reorderProductsAction(reordered);
      if ("error" in result) toast.error(result.error);
      else router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      {editing && (
        <ProductDialog key={editing.id} product={editing} onClose={() => setEditing(null)} />
      )}
      <div className="rounded-lg border divide-y">
        {initialProducts.map((product, index) => (
          <div key={product.id} className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{product.name_he}</span>
                <span className="text-sm text-muted-foreground">
                  ₪{product.price_ils.toLocaleString("he-IL")}
                </span>
                {!product.is_active && <Badge variant="outline">מוסתר</Badge>}
                {product.once_per_trainee && <Badge variant="secondary">חד-פעמי</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">
                {product.sessions_total !== null ? `${product.sessions_total} אימונים · ` : ""}
                {product.duration_days} ימים
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => move(index, -1)} disabled={reordering || index === 0} aria-label="העבר למעלה">
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => move(index, 1)} disabled={reordering || index === initialProducts.length - 1} aria-label="העבר למטה">
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setEditing(product)} aria-label={`ערוך ${product.name_he}`}>
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
