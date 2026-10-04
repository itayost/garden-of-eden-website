"use client";

import { useState } from "react";
import type { PlanProduct } from "@/types/plans";
import type { EnrollmentInput } from "@/lib/validations/enrollment";
import type { RenewalLocks } from "@/lib/plans/bound-renewal";
import { startCheckoutAction } from "../lib/actions/start-checkout";
import { EnrollmentForm } from "./EnrollmentForm";
import { PlanCatalog } from "./PlanCatalog";

interface JoinPageClientProps {
  products: PlanProduct[];
  initialProductId: string | null;
  renewalToken: string | null;
  prefill?: Partial<EnrollmentInput>;
  locks?: RenewalLocks;
}

export function JoinPageClient({
  products,
  initialProductId,
  renewalToken,
  prefill,
  locks,
}: JoinPageClientProps) {
  const [selected, setSelected] = useState<PlanProduct | null>(
    products.find((p) => p.id === initialProductId) ?? null,
  );
  // Arriving with a product (a landing-page card, a renewal link) opens the
  // form directly; the catalog only shows when there is nothing chosen yet
  // or the parent asks to change. A renewal link whose product is gone or
  // one-time (the intro pack) has no product and starts at the catalog.
  const [changing, setChanging] = useState(false);
  const showCatalog = selected === null || changing;

  const choose = (product: PlanProduct) => {
    setSelected(product);
    setChanging(false);
  };

  // A full page load into the card page, so its enforced CSP applies; a
  // client-side navigation would keep this page's report-only policy.
  const handleSubmit = async (input: EnrollmentInput): Promise<{ error?: string }> => {
    const result = await startCheckoutAction(input);
    if ("payUrl" in result) {
      window.location.assign(result.payUrl);
      return {};
    }
    return result;
  };

  if (products.length === 0) {
    return (
      <p className="rounded-2xl border bg-white p-8 text-center text-black/60">
        אין כרגע מסלולים פתוחים להרשמה. דברו איתנו בוואטסאפ.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {renewalToken && initialProductId === null && (
        <p className="rounded-2xl border bg-white p-4 text-sm text-black/70">
          הפרטים מולאו מההרשמה הקודמת. בחרו את המסלול הבא, אשרו את ההצהרות וחתמו שוב.
        </p>
      )}
      {showCatalog ? (
        <PlanCatalog
          products={products}
          selectedId={selected?.id ?? null}
          onSelect={choose}
        />
      ) : (
        selected && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white px-5 py-4">
            <div>
              <span className="block text-xs text-black/60">המסלול שנבחר</span>
              <span className="text-lg font-bold">
                {selected.name_he} · ₪{selected.price_ils.toLocaleString("he-IL")}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setChanging(true)}
              className="text-sm underline underline-offset-2 text-black/70 hover:text-black"
            >
              שינוי מסלול
            </button>
          </div>
        )
      )}
      {renewalToken && initialProductId !== null && selected && (
        <p className="rounded-2xl border bg-white p-4 text-sm text-black/70">
          חידוש המסלול <span className="font-bold">{selected.name_he}</span>. הפרטים מולאו
          מההרשמה הקודמת; יש לאשר את ההצהרות ולחתום שוב.
        </p>
      )}
      {selected && (
        <section id="enroll" className="space-y-4">
          <h2 className="text-xl font-bold sm:text-2xl">הסכם התקשרות והרשמה</h2>
          <EnrollmentForm
            key={selected.id}
            product={selected}
            prefill={prefill}
            locks={locks}
            renewalToken={renewalToken ?? undefined}
            onSubmit={handleSubmit}
          />
        </section>
      )}
    </div>
  );
}
