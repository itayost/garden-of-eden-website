import { describe, expect, it } from "vitest";
import { arboxTermsFromProduct, arboxTermsProblem } from "../arbox-terms";

const card = { sessions_total: 20, duration_days: 196, price_ils: 2000 };
const subscription = { sessions_total: null, duration_days: 30, price_ils: 850 };

describe("arboxTermsFromProduct", () => {
  it("pre-fills a card's sessions, price, and an end date from its duration", () => {
    expect(arboxTermsFromProduct(card, "2026-09-24")).toEqual({
      startsOn: "2026-09-24",
      endsOn: "2027-04-07",
      sessionsTotal: "20",
      amountIls: "2000",
    });
  });

  it("leaves sessions empty for a product that sells time", () => {
    expect(arboxTermsFromProduct(subscription, "2026-09-24").sessionsTotal).toBe("");
  });

  it("counts the start day as the first day, like fulfillment does", () => {
    expect(arboxTermsFromProduct({ ...card, duration_days: 1 }, "2026-09-24").endsOn).toBe("2026-09-24");
  });
});

describe("arboxTermsProblem", () => {
  const today = "2026-09-24";
  const terms = { startsOn: "2026-09-24", endsOn: "2026-12-23", amountIls: 2000 };

  it("accepts a card sold today", () => {
    expect(arboxTermsProblem(terms, today)).toBeNull();
  });

  it("accepts a card bought months ago that is still running", () => {
    expect(arboxTermsProblem({ ...terms, startsOn: "2026-05-01" }, today)).toBeNull();
  });

  it("accepts a plan that ends today", () => {
    expect(arboxTermsProblem({ ...terms, endsOn: today }, today)).toBeNull();
  });

  it("refuses a plan that is already over", () => {
    expect(arboxTermsProblem({ ...terms, startsOn: "2026-08-01", endsOn: "2026-09-23" }, today)).not.toBeNull();
  });

  it("refuses a start more than a year back or a year ahead", () => {
    expect(arboxTermsProblem({ ...terms, startsOn: "2025-09-23" }, today)).not.toBeNull();
    expect(arboxTermsProblem({ ...terms, startsOn: "2027-09-25", endsOn: "2027-10-25" }, today)).not.toBeNull();
  });

  it("refuses a plan longer than a year", () => {
    expect(arboxTermsProblem({ ...terms, endsOn: "2099-12-31" }, today)).not.toBeNull();
  });

  it("refuses an amount under one shekel", () => {
    expect(arboxTermsProblem({ ...terms, amountIls: 0.5 }, today)).not.toBeNull();
  });
});
