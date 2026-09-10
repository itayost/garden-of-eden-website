import type { PlanProduct } from "@/types/plans";

/**
 * Copy for the קריית אתא landing page. The Haifa page keeps its hardcoded
 * copy; this file holds only what differs. Location details are null until
 * Eden supplies them, and the page hides the map and address until then.
 */
export const KIRYAT_ATA_LANDING = {
  path: "/kiryat-ata",
  branchName: "קריית אתא",
  hero: {
    eyebrow: "סניף קריית אתא",
    titleStart: "אקדמיית הכדורגל",
    titleAccent: "Garden of Eden",
    titleEnd: "מגיעה לקריית אתא",
    subtitle:
      "אימוני כדורגל מקצועיים בקבוצות קטנות, עם מעטפת מנטלית ותזונתית. נרשמים ומשלמים כאן באתר, ומתחילים.",
    ctaLabel: "הצטרפו עכשיו",
    ctaHref: "/join",
  },
  services: {
    title: "מסלולי האימונים בקריית אתא",
    subtitle: "בוחרים מסלול, ממלאים את הסכם ההרשמה ומשלמים באתר. החשבונית מגיעה למייל.",
    highlightedSlug: "monthly",
  },
  location: {
    address: null as string | null,
    mapEmbedUrl: null as string | null,
    hours: null as string | null,
    whatsapp: "972525779446",
    phoneDisplay: "052-577-9446",
  },
  /** FAQ entries whose Haifa answer does not hold here. */
  faqOverrides: {
    "faq-1": "שעות הפעילות בקריית אתא נקבעות לפי לוח האימונים ומתפרסמות באפליקציה אחרי ההרשמה.",
  } as Record<string, string>,
  /** Haifa-only FAQ entries: public transport to the Haifa complex. */
  faqOmit: ["faq-7"],
} as const;

/** Card bullets per product. Anything not listed falls back to the DB fields. */
const FEATURES_BY_SLUG: Record<string, readonly string[]> = {
  monthly: ["2 אימונים בשבוע", "ללא התחייבות: חידוש חודש בחודש מקישור בוואטסאפ", "מעקב התקדמות באפליקציה"],
  intro_pack: ["4 אימונים להיכרות", "לשחקן חדש בלבד, פעם אחת", "בלי התחייבות להמשך"],
  card_10: ["10 אימונים", "מתאים ללו\"ז משתנה", "האימונים נרשמים אוטומטית מהנוכחות"],
  card_20: ["20 אימונים", "המחיר הנמוך ביותר לאימון", "מתאים לשחקן שמתאמן פעמיים בשבוע"],
  term_4_months: ["4 חודשי אימונים", "מסלול המתקדמים המלא", "מעקב התקדמות ומבדקים"],
  addon_monthly: ["מפגש מנטלי, תזונה או טקטי מדי חודש", "משלים כל מסלול אימונים", "ללא התחייבות"],
  addon_single: ["מפגש אחד עם איש המקצוע", "מנטלי, תזונה או טקטי", "נקבע מול הצוות אחרי הרכישה"],
};

function weeksLabel(days: number): string {
  const weeks = Math.round(days / 7);
  if (days === 30) return "בתוקף לחודש";
  if (days % 30 === 0) return `בתוקף ${days / 30} חודשים`;
  return `בתוקף ${weeks} שבועות`;
}

export function featuresFor(product: PlanProduct): readonly string[] {
  const listed = FEATURES_BY_SLUG[product.slug];
  const gift = product.gift_he ? [`מתנה: ${product.gift_he}`] : [];
  if (listed) return [...listed, ...gift];
  const sessions =
    product.sessions_total === null
      ? []
      : [product.sessions_total === 1 ? "אימון אחד" : `${product.sessions_total} אימונים`];
  return [...sessions, weeksLabel(product.duration_days), ...gift];
}

export function periodFor(product: PlanProduct): string {
  if (product.kind === "subscription" || product.kind === "addon") {
    return product.duration_days === 30 ? "לחודש" : weeksLabel(product.duration_days);
  }
  return product.sessions_total !== null
    ? `${product.sessions_total} אימונים, ${weeksLabel(product.duration_days)}`
    : weeksLabel(product.duration_days);
}
