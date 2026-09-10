/**
 * Search metadata per branch. The root layout carries only brand-wide
 * defaults; each landing page pulls its own entry so titles, descriptions,
 * social cards, canonical URLs, and structured data name the right city.
 */
export const SITE_URL = "https://www.edengarden.co.il";
export const BRAND = "Garden of Eden";

export interface BranchSeo {
  key: "haifa" | "kiryat_ata";
  path: string;
  cityHe: string;
  title: string;
  description: string;
  keywords: readonly string[];
  address: { street: string; city: string; postalCode?: string };
  geo: { lat: number; lng: number } | null;
  phone: string;
  email: string;
  /** schema.org openingHoursSpecification text, null until known. */
  openingHours: readonly string[] | null;
  /** Where the page sends a parent who wants to join. */
  joinUrl: string;
}

export const BRANCH_SEO: Record<BranchSeo["key"], BranchSeo> = {
  haifa: {
    key: "haifa",
    path: "/",
    cityHe: "חיפה",
    title: "אקדמיית הכדורגל עם מעטפת מלאה | חיפה",
    description:
      "אקדמיית כדורגל מקצועית בחיפה עם מעטפת מלאה: אימוני כדורגל, אימוני אתלטיות, ליווי מנטלי, ליווי תזונה, אנליסט כדורגל וניהול קריירה.",
    keywords: [
      "אקדמיית כדורגל",
      "כדורגל חיפה",
      "אימוני כדורגל חיפה",
      "אימוני אתלטיות",
      "ליווי מנטלי",
      "תזונת ספורטאים",
      "אנליסט כדורגל",
      "ניהול קריירה",
      "garden of eden",
      "שחקנים צעירים",
    ],
    address: { street: "שלמה המלך 57", city: "חיפה" },
    geo: { lat: 32.81152907364922, lng: 34.95703787613971 },
    phone: "+972-52-577-9446",
    email: "gardenofeden22250@gmail.com",
    openingHours: ["Su-Th 08:00-21:00", "Fr 08:00-15:00"],
    joinUrl: "https://wa.me/972525779446",
  },
  kiryat_ata: {
    key: "kiryat_ata",
    path: "/kiryat-ata",
    cityHe: "קריית אתא",
    title: "אקדמיית כדורגל בקריית אתא | הרשמה ותשלום באתר",
    description:
      "אימוני כדורגל מקצועיים בקריית אתא בקבוצות קטנות, עם ליווי מנטלי ותזונתי. בוחרים מסלול, נרשמים ומשלמים באתר.",
    keywords: [
      "אקדמיית כדורגל",
      "כדורגל קריית אתא",
      "אימוני כדורגל לילדים קריית אתא",
      "חוג כדורגל קריית אתא",
      "אימוני כדורגל הקריות",
      "garden of eden",
      "קריית אתא",
    ],
    address: { street: "דרך חיפה 18", city: "קריית אתא" },
    geo: null,
    phone: "+972-52-577-9446",
    email: "Gardenkrayot@gmail.com",
    openingHours: null,
    joinUrl: `${SITE_URL}/join`,
  },
};

/** The Next.js metadata block for one branch's landing page. */
export function branchMetadata(seo: BranchSeo) {
  const url = `${SITE_URL}${seo.path}`;
  const fullTitle = `${BRAND} - ${seo.title}`;
  return {
    title: fullTitle,
    description: seo.description,
    keywords: [...seo.keywords],
    alternates: { canonical: seo.path },
    openGraph: {
      type: "website" as const,
      locale: "he_IL",
      url,
      siteName: BRAND,
      title: fullTitle,
      description: seo.description,
      images: [{ url: "/og-image.png", width: 1200, height: 630, alt: `${BRAND} - ${seo.cityHe}` }],
    },
    twitter: {
      card: "summary_large_image" as const,
      title: fullTitle,
      description: seo.description,
      images: ["/og-image.png"],
    },
  };
}
