import { describe, expect, it } from "vitest";
import { manualCardProblem, readManualCard } from "../manual-card";

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
