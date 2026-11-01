import { describe, expect, it } from "vitest";
import { maxInstallmentsFor } from "../installments";

const catalog = (max: number | null) => ({ max_installments: max, staff_terms: false });
const manual = { max_installments: 3, staff_terms: true };
const noTerms = { terms_sessions_total: null };

describe("maxInstallmentsFor", () => {
  it("uses the catalog product's own cap", () => {
    expect(maxInstallmentsFor(catalog(3), noTerms)).toBe(3);
    expect(maxInstallmentsFor(catalog(2), noTerms)).toBe(2);
    expect(maxInstallmentsFor(catalog(1), noTerms)).toBe(1);
  });

  it("falls back to the global limit when the product has none", () => {
    expect(maxInstallmentsFor(catalog(null), noTerms)).toBe(3);
  });

  it("never goes past the global limit or below one", () => {
    expect(maxInstallmentsFor(catalog(12), noTerms)).toBe(3);
    expect(maxInstallmentsFor(catalog(0), noTerms)).toBe(1);
  });

  it("caps a manual Card by the sessions on its order", () => {
    expect(maxInstallmentsFor(manual, { terms_sessions_total: 24 })).toBe(3);
    expect(maxInstallmentsFor(manual, { terms_sessions_total: 20 })).toBe(3);
    expect(maxInstallmentsFor(manual, { terms_sessions_total: 19 })).toBe(2);
    expect(maxInstallmentsFor(manual, { terms_sessions_total: 10 })).toBe(2);
    expect(maxInstallmentsFor(manual, { terms_sessions_total: 4 })).toBe(1);
    expect(maxInstallmentsFor(manual, noTerms)).toBe(1);
  });
});
