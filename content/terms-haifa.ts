import { TERMS_SECTIONS, type TermsSection } from "./terms-kiryat-ata";

/**
 * תקנון סניף חיפה: the קריית אתא terms word for word, with Haifa's own plans.
 *
 * Written from the Haifa price poster on 2026-11-09 for the owner to review.
 * The version string is stored on every signed agreement, so changing the
 * text means bumping it.
 */
export const HAIFA_TERMS_VERSION = "2026-11-haifa";

const HAIFA_PLANS: TermsSection = {
  title: "המסלולים",
  items: [
    "מנוי חודשי 2 אימונים בשבוע: בתוקף 30 יום מיום הרכישה.",
    "מנוי חודשי אימון אחד בשבוע: בתוקף 30 יום מיום הרכישה.",
    "מנוי חודשי ללא הגבלה: אימונים ללא הגבלה, בתוקף 30 יום מיום הרכישה.",
    "מסלול היכרות: 2 אימונים, לשחקן חדש בלבד, פעם אחת.",
    "כרטיסיית 10 אימונים בתוקף 14 שבועות.",
    "אימון נספר כאשר החניך משובץ ללוח האימונים של אותו יום.",
  ],
};

export const HAIFA_TERMS_SECTIONS: readonly TermsSection[] = [
  HAIFA_PLANS,
  ...TERMS_SECTIONS.filter((s) => s.title !== HAIFA_PLANS.title),
];
