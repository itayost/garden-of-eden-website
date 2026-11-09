"use client";

import { Check } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { PlanProduct } from "@/types/plans";

type PickerProduct = PlanProduct & { branchName?: string };

/** Consecutive products of one branch; the list arrives branch by branch. */
function byBranch(products: readonly PickerProduct[]): { name: string; products: PickerProduct[] }[] {
  return products.reduce<{ name: string; products: PickerProduct[] }[]>((groups, product) => {
    const name = product.branchName ?? "";
    const last = groups[groups.length - 1];
    return last && last.name === name
      ? [...groups.slice(0, -1), { name, products: [...last.products, product] }]
      : [...groups, { name, products: [product] }];
  }, []);
}

/**
 * Compact product rows for a phone: name, price, one tap. A list that spans
 * branches (an Admin's new-trainee sheet) names the branch above its plans.
 */
export function ProductPicker({
  products,
  selectedId,
  onSelect,
  disabled,
}: {
  products: PickerProduct[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  disabled?: boolean;
}) {
  const groups = byBranch(products);
  const named = groups.length > 1;
  return (
    <div className="space-y-2">
      <Label>מסלול</Label>
      <div className="space-y-3" role="radiogroup" aria-label="מסלול">
        {groups.map((group) => (
          <div key={group.name} className="space-y-1.5">
            {named && group.name && <p className="text-xs font-medium text-muted-foreground">סניף {group.name}</p>}
            {group.products.map((product) => {
              const selected = product.id === selectedId;
              return (
                <button
                  key={product.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={named && group.name ? `${product.name_he}, סניף ${group.name}` : undefined}
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
        ))}
      </div>
    </div>
  );
}
