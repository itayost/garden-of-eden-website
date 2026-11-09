import type { Metadata } from "next";
import { loadJoinCatalog } from "@/features/enrollment/lib/catalog";
import { JoinPageClient } from "@/features/enrollment/components/JoinPageClient";
import { JoinFrame } from "@/features/enrollment/components/JoinFrame";
import { BranchChoice } from "@/features/enrollment/components/BranchChoice";
import { loadRenewalPrefill } from "@/features/plans/lib/actions/renewal-prefill";
import { PaymentsClosedNotice } from "@/features/enrollment/components/PaymentsClosedNotice";
import { canPayOnline } from "@/lib/payments/online-payments";
import { landingBranchByKey, pickJoinBranch, type LandingBranch } from "@/lib/branches/landing-branches";

interface PageProps {
  searchParams: Promise<{ product?: string; renew?: string; branch?: string }>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const branch = landingBranchByKey((await searchParams).branch);
  return branch ? { title: `הרשמה לסניף ${branch.nameHe} | Garden of Eden` } : {};
}

const heading = (branch: LandingBranch | null) => (branch ? `הרשמה לסניף ${branch.nameHe}` : "הרשמה");

/**
 * The signup and payment page of every branch that sells in the app. The
 * branch comes from the link: a renewal names its Plan's, a landing-page card
 * its product's, and ?branch= the rest. A bare /join opens the only selling
 * branch, or asks which one.
 */
export default async function JoinPage({ searchParams }: PageProps) {
  const params = await searchParams;
  if (!(await canPayOnline())) {
    const requested = landingBranchByKey(params.branch);
    return (
      <JoinFrame branch={requested}>
        <div className="space-y-6">
          <h1 className="text-2xl font-bold text-black sm:text-3xl">{heading(requested)}</h1>
          <PaymentsClosedNotice />
        </div>
      </JoinFrame>
    );
  }
  const [{ branches, catalogs }, renewal] = await Promise.all([
    loadJoinCatalog(),
    // An invalid token falls through to a normal, unprefilled page.
    params.renew ? loadRenewalPrefill(params.renew) : Promise.resolve(null),
  ]);
  const productBranch = params.product
    ? branches.find((b) => catalogs.get(b.id)?.some((p) => p.id === params.product))
    : undefined;
  const branch = pickJoinBranch(branches, {
    renewal: renewal?.branchIds ?? [],
    productBranchId: productBranch?.id ?? null,
    requestedKey: params.branch ?? null,
  });

  if (!branch) {
    return (
      <JoinFrame branch={null}>
        <div className="space-y-6">
          <header>
            <h1 className="text-2xl font-bold text-black sm:text-3xl">{heading(null)}</h1>
            <p className="mt-2 text-sm text-black/60 sm:text-base">באיזה סניף החניך/ה מתאמן/ת?</p>
          </header>
          <BranchChoice branches={branches.filter((b) => b.sells)} />
        </div>
      </JoinFrame>
    );
  }

  return (
    <JoinFrame branch={branch}>
      <div className="space-y-10">
        <header>
          <p className="text-sm font-medium text-black/60">שלב 1 מתוך 2</p>
          <h1 className="mt-1 text-2xl font-bold text-black sm:text-3xl">{heading(branch)}</h1>
          <p className="mt-2 text-sm text-black/60 sm:text-base">
            בוחרים מסלול, ממלאים את הסכם ההרשמה ועוברים לתשלום מאובטח. החשבונית מגיעה למייל, וקוד
            ההתחברות לאפליקציה מגיע בוואטסאפ.
          </p>
        </header>
        <JoinPageClient
          key={branch.key}
          branch={branch.key}
          products={catalogs.get(branch.id) ?? []}
          initialProductId={renewal?.productId ?? params.product ?? null}
          renewalToken={renewal ? (params.renew ?? null) : null}
          prefill={renewal?.prefill}
          locks={renewal?.locks}
          renewedUntil={renewal?.renewedUntil ?? null}
        />
      </div>
    </JoinFrame>
  );
}
