import type { PlanProduct } from "@/types/plans";

/**
 * The words on a landing page's price cards, for every branch. Slugs are
 * unique across branches (plan_products.slug), so one table serves all of
 * them. A product not listed here falls back to its database fields.
 */
const FEATURES_BY_SLUG: Record<string, readonly string[]> = {
  // קריית אתא
  monthly: ["2 אימונים בשבוע", "ללא התחייבות: חידוש חודש בחודש מקישור בוואטסאפ", "מעקב התקדמות באפליקציה"],
  intro_pack: ["4 אימונים להיכרות", "לשחקן חדש בלבד, פעם אחת", "בלי התחייבות להמשך"],
  card_10: ["10 אימונים", "מתאים ללו\"ז משתנה", "האימונים נרשמים אוטומטית מהנוכחות"],
  card_20: ["20 אימונים", "המחיר הנמוך ביותר לאימון", "מתאים לשחקן שמתאמן פעמיים בשבוע"],
  term_4_months: ["4 חודשי אימונים", "מסלול המתקדמים המלא", "מעקב התקדמות ומבדקים"],
  addon_monthly: ["מפגש מנטלי, תזונה או טקטי מדי חודש", "משלים כל מסלול אימונים", "ללא התחייבות"],
  addon_single: ["מפגש אחד עם איש המקצוע", "מנטלי, תזונה או טקטי", "נקבע מול הצוות אחרי הרכישה"],
  // חיפה, in the wording of the branch's poster
  haifa_twice_weekly: ["כדורגל", "כוח ואתלטיקה", "מעטפת תזונתית", "מנטלית וטקטית"],
  haifa_once_weekly: ["כדורגל", "כוח ואתלטיקה", "מעטפת תזונתית", "מנטלית וטקטית"],
  haifa_intro: ["2 אימונים", "היכרות עם השיטה ועם המאמנים", "לשחקן חדש בלבד, פעם אחת"],
  haifa_unlimited: ["אימונים ללא הגבלה", "כדורגל", "כוח ואתלטיקה", "מעטפת תזונתית ומנטלית"],
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
  if (product.kind === "addon" && product.sessions_total !== null) {
    return product.sessions_total === 1 ? "מפגש אחד" : `${product.sessions_total} מפגשים`;
  }
  if (product.kind === "subscription" || product.kind === "addon") {
    return product.duration_days === 30 ? "לחודש" : weeksLabel(product.duration_days);
  }
  return product.sessions_total !== null
    ? `${product.sessions_total} אימונים, ${weeksLabel(product.duration_days)}`
    : weeksLabel(product.duration_days);
}
