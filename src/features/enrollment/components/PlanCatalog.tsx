"use client";

import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PlanProduct } from "@/types/plans";

interface PlanCatalogProps {
  products: PlanProduct[];
  selectedId: string | null;
  onSelect: (product: PlanProduct) => void;
}

function periodLabel(product: PlanProduct): string {
  if (product.sessions_total !== null) {
    const weeks = Math.round(product.duration_days / 7);
    const sessions = product.sessions_total === 1 ? "אימון אחד" : `${product.sessions_total} אימונים`;
    return `${sessions}, בתוקף ${weeks} שבועות`;
  }
  if (product.duration_days === 30) return "לחודש";
  return `ל-${Math.round(product.duration_days / 30)} חודשים`;
}

export function PlanCatalog({ products, selectedId, onSelect }: PlanCatalogProps) {
  return (
    <div className="space-y-3">
    <p className="text-sm text-black/60">המחירים בשקלים חדשים וכוללים מע&quot;מ.</p>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => {
        const selected = product.id === selectedId;
        return (
          <button
            key={product.id}
            type="button"
            onClick={() => onSelect(product)}
            aria-pressed={selected}
            className={cn(
              "flex h-full flex-col rounded-2xl border bg-white p-4 text-start transition-all sm:p-6",
              selected
                ? "border-2 border-[#CDEA68] shadow-lg"
                : "border-black/10 hover:border-black/20 hover:shadow-md",
            )}
          >
            <h3 className="text-lg font-bold text-black">{product.name_he}</h3>
            {product.blurb_he && (
              <p className="mt-1 text-sm text-black/50">{product.blurb_he}</p>
            )}
            <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-0">
              <span className="text-2xl font-bold text-black sm:text-3xl">
                ₪{product.price_ils.toLocaleString("he-IL")}
              </span>
              <span className="text-sm text-black/40">{periodLabel(product)}</span>
            </div>
            {product.gift_he && (
              <p className="mt-3 rounded-xl bg-[#CDEA68]/30 px-3 py-2 text-xs text-black/70">
                {product.gift_he}
              </p>
            )}
            <div className="mt-auto pt-4">
              <Button
                type="button"
                variant={selected ? "default" : "outline"}
                className="h-11 w-full rounded-full"
                tabIndex={-1}
              >
                {selected ? <Check className="h-4 w-4 me-2" /> : null}
                {selected ? "נבחר" : "בחירה"}
              </Button>
            </div>
          </button>
        );
      })}
    </div>
    </div>
  );
}
