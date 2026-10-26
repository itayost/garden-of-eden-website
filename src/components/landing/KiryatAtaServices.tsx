import Link from "next/link";
import { Brain, CalendarDays, Ticket, Trophy, Users, type LucideIcon } from "lucide-react";
import type { PlanKind, PlanProduct } from "@/types/plans";
import { featuresFor, KIRYAT_ATA_LANDING, periodFor } from "../../../content/landing-kiryat-ata";
import { PosterPlanCard, type PosterPlan } from "./poster/PosterPlanCard";
import { PosterSection } from "./poster/PosterSection";

const KIND_ICONS: Record<PlanKind, LucideIcon> = {
  subscription: Users,
  session_card: Ticket,
  term: Trophy,
  addon: Brain,
};

const KIND_LABELS: Record<PlanKind, string> = {
  subscription: "מנוי חודשי",
  session_card: "כרטיסייה",
  term: "מסלול תקופתי",
  addon: "תוספת למסלול",
};

function toPosterPlan(product: PlanProduct, highlightedSlug: string): PosterPlan {
  return {
    icon: product.once_per_trainee ? CalendarDays : KIND_ICONS[product.kind],
    name: product.name_he,
    description: product.blurb_he ?? KIND_LABELS[product.kind],
    price: product.price_ils.toLocaleString("he-IL"),
    period: periodFor(product),
    features: featuresFor(product),
    highlighted: product.slug === highlightedSlug,
    cta: { kind: "join", label: "הצטרפו", href: `/join?product=${product.id}` },
  };
}

/**
 * The קריית אתא price cards in the Haifa poster's look, fed by plan_products
 * so the landing page, the catalog CMS, and /join never disagree on a price.
 * Every card leads to the signup and payment page with that product preselected.
 */
export function KiryatAtaServices({ products }: { products: PlanProduct[] }) {
  const { services, location, branchName } = KIRYAT_ATA_LANDING;

  return (
    <PosterSection
      branchLabel={`סניף ${branchName}`}
      address={location.address}
      phoneE164={location.whatsapp}
      phoneDisplay={location.phoneDisplay}
      secondaryAction={{
        label: "שאלה בוואטסאפ",
        href: `https://wa.me/${location.whatsapp}?text=${encodeURIComponent(
          "היי, יש לי שאלה על מסלולי האימונים בקריית אתא. תודה!",
        )}`,
        external: true,
      }}
      intro={services.subtitle}
      notes={
        <>
          <p>* המחירים בשקלים חדשים וכוללים מע&quot;מ. התשלום בכרטיס אשראי בעמוד תשלום מאובטח.</p>
          <p>
            * ביטול והחזר לפי{" "}
            <Link href="/cancellation-policy" className="underline underline-offset-4 hover:text-[#f6fbf4]">
              מדיניות ביטול העסקה
            </Link>
            .
          </p>
        </>
      }
    >
      {products.length === 0 ? (
        <p className="text-center text-lg text-[#c9d8c6]">המחירון יתפרסם בקרוב. בינתיים אפשר לכתוב לנו בוואטסאפ.</p>
      ) : (
        products.map((product) => (
          <PosterPlanCard key={product.id} plan={toPosterPlan(product, services.highlightedSlug)} />
        ))
      )}
    </PosterSection>
  );
}
