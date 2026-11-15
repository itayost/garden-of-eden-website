import Link from "next/link";
import { Brain, CalendarDays, Ticket, Trophy, Users, type LucideIcon } from "lucide-react";
import { joinHref, type LandingBranchKey } from "@/lib/branches/landing-branches";
import type { PlanKind, PlanProduct } from "@/types/plans";
import { featuresFor, periodFor } from "../../../content/landing-plans";
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

/** What a branch's price section says around its cards. */
export interface BranchServicesCopy {
  branchName: string;
  intro: string;
  /** The gold card. */
  highlightedSlug: string;
  address: string;
  /** Digits only, international form. */
  whatsapp: string;
  phoneDisplay: string;
  /** Branch small print, above the payment and cancellation lines. */
  notes?: readonly string[];
}

function toPosterPlan(branch: LandingBranchKey, product: PlanProduct, highlightedSlug: string): PosterPlan {
  return {
    icon: product.once_per_trainee ? CalendarDays : KIND_ICONS[product.kind],
    name: product.name_he,
    description: product.blurb_he ?? KIND_LABELS[product.kind],
    price: product.price_ils.toLocaleString("he-IL"),
    period: periodFor(product),
    features: featuresFor(product),
    highlighted: product.slug === highlightedSlug,
    cta: { kind: "join", label: "הצטרפו", href: joinHref(branch, product.id) },
  };
}

/**
 * A branch's price cards in the Haifa poster's look, fed by plan_products so
 * the landing page, the catalog CMS, and /join never disagree on a price.
 * Every card leads to the signup and payment page with that product preselected.
 */
export function BranchServices({
  branch,
  products,
  copy,
}: {
  branch: LandingBranchKey;
  products: PlanProduct[];
  copy: BranchServicesCopy;
}) {
  return (
    <PosterSection
      branchLabel={`סניף ${copy.branchName}`}
      address={copy.address}
      phoneE164={copy.whatsapp}
      phoneDisplay={copy.phoneDisplay}
      secondaryAction={{
        label: "שאלה בוואטסאפ",
        href: `https://wa.me/${copy.whatsapp}?text=${encodeURIComponent(
          `היי, יש לי שאלה על מסלולי האימונים ב${copy.branchName}. תודה!`,
        )}`,
        external: true,
      }}
      intro={copy.intro}
      notes={
        <>
          {copy.notes?.map((note) => <p key={note}>{note}</p>)}
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
          <PosterPlanCard key={product.id} plan={toPosterPlan(branch, product, copy.highlightedSlug)} />
        ))
      )}
    </PosterSection>
  );
}
