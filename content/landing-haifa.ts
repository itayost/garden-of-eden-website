/**
 * The Haifa landing page's price section, now fed by plan_products like
 * קריית אתא's. The rest of the Haifa page keeps its hardcoded copy. The
 * price cards' words are in landing-plans.ts.
 */
export const HAIFA_LANDING = {
  branchName: "חיפה",
  services: {
    subtitle: "בוחרים מסלול, ממלאים את הסכם ההרשמה ומשלמים באתר. החשבונית מגיעה למייל.",
    /** The gold card on the branch poster. */
    highlightedSlug: "haifa_unlimited",
    /** Small print the poster carries under the address. */
    notes: ["* כל האימונים משולבים עם כדור"],
  },
  location: {
    address: "רחוב המלך שלמה 57, חיפה",
    whatsapp: "972525779446",
    phoneDisplay: "052-5779446",
  },
} as const;
