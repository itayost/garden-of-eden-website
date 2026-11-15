/**
 * Copy for the קריית אתא landing page; this file holds only what differs
 * from the Haifa page. The price cards' words are in landing-plans.ts.
 * Location details are null until Eden supplies them, and the page hides the
 * map and address until then.
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
    ctaHref: "#services",
    imageSrc: "/landing/kiryat-ata/agility-drill.webp",
  },
  /** Branch photos (issue #148), in the order of the About feature cards. */
  about: {
    featureImages: [
      { src: "/landing/kiryat-ata/body-composition.webp", position: "center 20%" },
      { src: "/landing/kiryat-ata/facility.webp", position: "center 55%" },
      { src: "/landing/kiryat-ata/group.webp", position: "center 35%" },
    ],
    videoPoster: "/landing/kiryat-ata/match.webp",
  },
  services: {
    subtitle: "בוחרים מסלול, ממלאים את הסכם ההרשמה ומשלמים באתר. החשבונית מגיעה למייל.",
    highlightedSlug: "monthly",
  },
  location: {
    address: "דרך חיפה 18, קריית אתא",
    mapEmbedUrl: "https://www.google.com/maps?q=%D7%93%D7%A8%D7%9A+%D7%97%D7%99%D7%A4%D7%94+18+%D7%A7%D7%A8%D7%99%D7%99%D7%AA+%D7%90%D7%AA%D7%90&output=embed",
    hours: null as string | null,
    whatsapp: "972525779446",
    phoneDisplay: "052-577-9446",
  },
  /** FAQ entries whose Haifa answer does not hold here. */
  faqOverrides: {
    "faq-1": "שעות הפעילות בקריית אתא נקבעות לפי לוח האימונים ומתפרסמות באפליקציה אחרי ההרשמה.",
    "faq-14": "קביעת אימונים דרך האתר המקצועי של הגארדן.",
  } as Record<string, string>,
  /** Haifa-only FAQ entries: public transport to the Haifa complex. */
  faqOmit: ["faq-7"],
} as const;
