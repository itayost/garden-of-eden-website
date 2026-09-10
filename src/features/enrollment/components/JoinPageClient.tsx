"use client";

import { useState } from "react";
import type { PlanProduct } from "@/types/plans";
import type { EnrollmentInput } from "@/lib/validations/enrollment";
import { startCheckoutAction } from "../lib/actions/start-checkout";
import { EnrollmentForm } from "./EnrollmentForm";
import { PlanCatalog } from "./PlanCatalog";

interface JoinPageClientProps {
  products: PlanProduct[];
  initialProductId: string | null;
  renewalToken: string | null;
  prefill?: Partial<EnrollmentInput>;
}

export function JoinPageClient({
  products,
  initialProductId,
  renewalToken,
  prefill,
}: JoinPageClientProps) {
  const [selected, setSelected] = useState<PlanProduct | null>(
    products.find((p) => p.id === initialProductId) ?? null,
  );
  // A renewal link whose product is gone or one-time (the intro pack) still
  // carries the prefill, but the parent picks the next plan from the catalog.
  const showCatalog = !renewalToken || initialProductId === null;

  // The action redirects to Morning on success and only returns on error.
  const handleSubmit = async (input: EnrollmentInput): Promise<{ error?: string }> => {
    const result = await startCheckoutAction(input);
    return result ?? {};
  };

  if (products.length === 0) {
    return (
      <p className="rounded-2xl border bg-white p-8 text-center text-black/60">
        אין כרגע מסלולים פתוחים להרשמה. דברו איתנו בוואטסאפ.
      </p>
    );
  }

  return (
    <div className="space-y-10">
      {renewalToken && initialProductId === null && (
        <p className="rounded-2xl border bg-white p-4 text-sm text-black/70">
          הפרטים מולאו מההרשמה הקודמת. בחרו את המסלול הבא, אשרו את ההצהרות וחתמו שוב.
        </p>
      )}
      {showCatalog && (
        <PlanCatalog
          products={products}
          selectedId={selected?.id ?? null}
          onSelect={setSelected}
        />
      )}
      {renewalToken && initialProductId !== null && selected && (
        <p className="rounded-2xl border bg-white p-4 text-sm text-black/70">
          חידוש המסלול <span className="font-bold">{selected.name_he}</span>. הפרטים מולאו
          מההרשמה הקודמת; יש לאשר את ההצהרות ולחתום שוב.
        </p>
      )}
      {selected && (
        <section id="enroll" className="rounded-3xl border bg-white p-6 sm:p-8">
          <h2 className="mb-6 text-2xl font-bold">הסכם התקשרות והרשמה</h2>
          <EnrollmentForm
            key={selected.id}
            product={selected}
            prefill={prefill}
            renewalToken={renewalToken ?? undefined}
            onSubmit={handleSubmit}
          />
        </section>
      )}
    </div>
  );
}
