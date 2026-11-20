import { describe, expect, it } from "vitest";
import {
  manualCardDraftFrom,
  manualCardProblem,
  orderManualTerms,
  orderPlanName,
  orderReceiptDescription,
  readManualCard,
} from "../manual-card";

const card = { sessions: 8, priceIls: 640, days: 90, subject: null };

describe("manualCardProblem", () => {
  it("accepts whole sessions, a price in shekels and agorot, and whole days", () => {
    expect(manualCardProblem(card)).toBeNull();
    expect(manualCardProblem({ sessions: 1, priceIls: 99.5, days: 1, subject: null })).toBeNull();
  });

  it("refuses sessions that are not a whole number from 1 to the Card cap", () => {
    expect(manualCardProblem({ ...card, sessions: 0 })).toBe("מספר האימונים בין 1 ל-200");
    expect(manualCardProblem({ ...card, sessions: 2.5 })).toBe("מספר האימונים בין 1 ל-200");
    expect(manualCardProblem({ ...card, sessions: 201 })).toBe("מספר האימונים בין 1 ל-200");
  });

  it("refuses a price of nothing or fractions of an agora", () => {
    expect(manualCardProblem({ ...card, priceIls: 0 })).toBe("הסכום לתשלום חייב להיות גדול מ-0");
    expect(manualCardProblem({ ...card, priceIls: 10.001 })).toBe("סכום בשקלים ובאגורות בלבד");
  });

  it("refuses validity that is not a whole number of days up to two years", () => {
    expect(manualCardProblem({ ...card, days: 0 })).toBe("תוקף בימים בין 1 ל-730");
    expect(manualCardProblem({ ...card, days: 731 })).toBe("תוקף בימים בין 1 ל-730");
  });

  it("accepts a one-line subject for the receipt", () => {
    expect(manualCardProblem({ ...card, subject: "מחנה פסח" })).toBeNull();
    expect(manualCardProblem({ ...card, subject: "א".repeat(60) })).toBeNull();
  });

  it("refuses a subject that is blank, too long, or more than one line", () => {
    const problem = "נושא בשורה אחת, עד 60 תווים";
    expect(manualCardProblem({ ...card, subject: "  " })).toBe(problem);
    expect(manualCardProblem({ ...card, subject: "א".repeat(61) })).toBe(problem);
    expect(manualCardProblem({ ...card, subject: "מחנה\nפסח" })).toBe(problem);
  });
});

describe("readManualCard", () => {
  it("reads the typed fields into terms, with no subject when none was typed", () => {
    expect(readManualCard({ sessions: "8", price: "640", days: "90", subject: "" })).toEqual({
      terms: card,
      problem: null,
    });
  });

  it("reads a typed subject without its surrounding spaces", () => {
    expect(readManualCard({ sessions: "8", price: "640", days: "90", subject: "  מחנה פסח " }).terms?.subject).toBe(
      "מחנה פסח",
    );
  });

  it("asks for every field but the subject before checking them", () => {
    expect(readManualCard({ sessions: "", price: "640", days: "90", subject: "מחנה פסח" })).toEqual({
      terms: null,
      problem: "נדרשים אימונים, מחיר ותוקף",
    });
  });

  it("passes on the rule's refusal", () => {
    expect(readManualCard({ sessions: "8", price: "640", days: "0", subject: "" }).problem).toBe("תוקף בימים בין 1 ל-730");
    expect(readManualCard({ sessions: "8", price: "640", days: "90", subject: "א".repeat(61) }).problem).toBe(
      "נושא בשורה אחת, עד 60 תווים",
    );
  });
});

describe("manualCardDraftFrom", () => {
  it("starts from the branch's catalog Card with no subject", () => {
    expect(manualCardDraftFrom({ sessions_total: 10, price_ils: 500, duration_days: 90 })).toEqual({
      sessions: "10",
      price: "500",
      days: "90",
      subject: "",
    });
  });
});

describe("orderManualTerms", () => {
  it("reads a manual Card's terms off the order", () => {
    expect(orderManualTerms({ terms_sessions_total: 8, terms_duration_days: 90 })).toEqual({ sessions: 8, days: 90 });
  });

  it("is null for a catalog sale", () => {
    expect(orderManualTerms({ terms_sessions_total: null, terms_duration_days: null })).toBeNull();
  });
});

describe("orderPlanName", () => {
  it("names a manual Card with its typed terms", () => {
    expect(orderPlanName("כרטיסייה ידנית", { terms_sessions_total: 8, terms_duration_days: 90 })).toBe(
      "כרטיסייה ידנית: 8 אימונים, 90 ימים",
    );
  });

  it("names a catalog sale by its product", () => {
    expect(orderPlanName("כרטיסיית 10", { terms_sessions_total: null, terms_duration_days: null })).toBe("כרטיסיית 10");
  });
});

describe("orderReceiptDescription", () => {
  const catalogOrder = { terms_sessions_total: null, terms_duration_days: null, invoice_subject: null, child_name: "נועם" };
  const manualOrder = { ...catalogOrder, terms_sessions_total: 8, terms_duration_days: 90 };

  it("names a catalog sale and the child, as before", () => {
    expect(orderReceiptDescription("כרטיסיית 10", catalogOrder)).toBe("כרטיסיית 10 - נועם");
  });

  it("names a manual Card with no subject by its terms, as before", () => {
    expect(orderReceiptDescription("כרטיסייה ידנית", manualOrder)).toBe("כרטיסייה ידנית: 8 אימונים, 90 ימים - נועם");
  });

  it("leads with the subject staff typed", () => {
    expect(orderReceiptDescription("כרטיסייה ידנית", { ...manualOrder, invoice_subject: "מחנה פסח" })).toBe(
      "מחנה פסח - כרטיסייה ידנית: 8 אימונים, 90 ימים - נועם",
    );
  });
});
