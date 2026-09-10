import { loadKiryatAtaCatalog } from "@/features/enrollment/lib/catalog";
import { JoinPageClient } from "@/features/enrollment/components/JoinPageClient";
import { loadRenewalPrefill } from "@/features/plans/lib/actions/renewal-prefill";

interface PageProps {
  searchParams: Promise<{ product?: string; renew?: string }>;
}

export default async function JoinPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const products = await loadKiryatAtaCatalog();
  // An invalid token falls through to a normal, unprefilled page.
  const renewal = params.renew ? await loadRenewalPrefill(params.renew) : null;

  return (
    <div className="space-y-10">
      <header>
        <p className="text-sm font-medium text-black/50">שלב 1 מתוך 2</p>
        <h1 className="mt-1 text-2xl font-bold text-black sm:text-3xl">הרשמה לסניף קריית אתא</h1>
        <p className="mt-2 text-sm text-black/50 sm:text-base">
          בוחרים מסלול, ממלאים את הסכם ההרשמה ועוברים לתשלום מאובטח. החשבונית מגיעה למייל, וקוד
          ההתחברות לאפליקציה מגיע בוואטסאפ.
        </p>
      </header>
      <JoinPageClient
        products={products}
        initialProductId={renewal?.productId ?? params.product ?? null}
        renewalToken={renewal ? (params.renew ?? null) : null}
        prefill={renewal?.prefill}
      />
    </div>
  );
}
