import { loadKiryatAtaCatalog } from "@/features/enrollment/lib/catalog";
import { JoinPageClient } from "@/features/enrollment/components/JoinPageClient";

interface PageProps {
  searchParams: Promise<{ product?: string; renew?: string }>;
}

export default async function JoinPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const products = await loadKiryatAtaCatalog();

  return (
    <div className="space-y-10">
      <header className="text-center">
        <p className="text-sm font-medium text-black/50">סניף קריית אתא</p>
        <h1 className="mt-1 text-4xl font-bold text-black">מסלולי אימונים נבחרים</h1>
        <p className="mx-auto mt-3 max-w-md text-black/50">
          בוחרים מסלול, ממלאים את הסכם ההרשמה ומשלמים בכרטיס אשראי. החשבונית מגיעה למייל, וקוד
          ההתחברות לאפליקציה מגיע בוואטסאפ.
        </p>
      </header>
      <JoinPageClient
        products={products}
        initialProductId={params.product ?? null}
        renewalToken={params.renew ?? null}
      />
    </div>
  );
}
