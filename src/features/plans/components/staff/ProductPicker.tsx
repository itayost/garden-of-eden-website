"use client";

import { Check } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { PlanProduct } from "@/types/plans";

/** Compact product rows for a phone: name, price, one tap. */
export function ProductPicker({
  products,
  selectedId,
  onSelect,
  disabled,
}: {
  products: PlanProduct[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>מסלול</Label>
      <div className="space-y-1.5" role="radiogroup" aria-label="מסלול">
        {products.map((product) => {
          const selected = product.id === selectedId;
          return (
            <button
              key={product.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onSelect(product.id)}
              className={cn(
                "flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-start transition-colors",
                selected ? "border-forest bg-forest/5" : "border-border hover:border-forest/50",
              )}
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{product.name_he}</span>
                {product.blurb_he && (
                  <span className="block truncate text-xs text-muted-foreground">{product.blurb_he}</span>
                )}
              </span>
              <span className="flex shrink-0 items-center gap-2 font-bold tabular-nums">
                ₪{product.price_ils.toLocaleString("he-IL")}
                {selected && <Check className="h-4 w-4 text-forest" />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
