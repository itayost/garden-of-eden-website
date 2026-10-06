import { describe, expect, it } from "vitest";
import { manualCardProblem, orderManualTerms, orderPlanName, planDisplayName, readManualCard } from "../manual-card";

describe("manualCardProblem", () => {
  it("accepts whole sessions, a price in shekels and agorot, and whole days", () => {
    expect(manualCardProblem({ sessions: 8, priceIls: 640, days: 90 })).toBeNull();
    expect(manualCardProblem({ sessions: 1, priceIls: 99.5, days: 1 })).toBeNull();
  });

  it("refuses sessions that are not a whole number from 1 to the Card cap", () => {
    expect(manualCardProblem({ sessions: 0, priceIls: 100, days: 30 })).toBe("מספר האימונים בין 1 ל-200");
    expect(manualCardProblem({ sessions: 2.5, priceIls: 100, days: 30 })).toBe("מספר האימונים בין 1 ל-200");
    expect(manualCardProblem({ sessions: 201, priceIls: 100, days: 30 })).toBe("מספר האימונים בין 1 ל-200");
  });

  it("refuses a price of nothing or fractions of an agora", () => {
    expect(manualCardProblem({ sessions: 8, priceIls: 0, days: 30 })).toBe("הסכום לתשלום חייב להיות גדול מ-0");
    expect(manualCardProblem({ sessions: 8, priceIls: 10.001, days: 30 })).toBe("סכום בשקלים ובאגורות בלבד");
  });

  it("refuses validity that is not a whole number of days up to two years", () => {
    expect(manualCardProblem({ sessions: 8, priceIls: 100, days: 0 })).toBe("תוקף בימים בין 1 ל-730");
    expect(manualCardProblem({ sessions: 8, priceIls: 100, days: 731 })).toBe("תוקף בימים בין 1 ל-730");
  });
});

describe("readManualCard", () => {
  it("reads the typed fields into terms", () => {
    expect(readManualCard({ sessions: "8", price: "640", days: "90" })).toEqual({
      terms: { sessions: 8, priceIls: 640, days: 90 },
      problem: null,
    });
  });

  it("asks for every field before checking them", () => {
    expect(readManualCard({ sessions: "", price: "640", days: "90" })).toEqual({ terms: null, problem: "נדרשים אימונים, מחיר ותוקף" });
  });

  it("passes on the rule's refusal", () => {
    expect(readManualCard({ sessions: "8", price: "640", days: "0" }).problem).toBe("תוקף בימים בין 1 ל-730");
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

describe("planDisplayName", () => {
  it("names a manual Card by the terms its Plan carries", () => {
    expect(planDisplayName({ name_he: "כרטיסייה ידנית", staff_terms: true }, { sessions_total: 8, duration_days: 60 })).toBe(
      "כרטיסייה ידנית: 8 אימונים, 60 ימים",
    );
  });

  it("leaves a catalog product's name as it is", () => {
    expect(planDisplayName({ name_he: "כרטיסייה 10", staff_terms: false }, { sessions_total: 10, duration_days: 90 })).toBe("כרטיסייה 10");
  });

  it("falls back to the product name when the terms are missing", () => {
    expect(planDisplayName({ name_he: "כרטיסייה ידנית", staff_terms: true }, { sessions_total: null, duration_days: 60 })).toBe("כרטיסייה ידנית");
  });
});
