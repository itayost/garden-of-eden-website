import { describe, expect, it } from "vitest";
import { branchSchema } from "../branch";

const BASE = {
  name_he: "חיפה",
  arbox_location_name: "Haifa",
  is_active: true,
};

describe("branchSchema manager phone", () => {
  it("accepts a locally formatted phone and stores canonical E.164", () => {
    const parsed = branchSchema.parse({
      ...BASE,
      manager_phone: "050-123-4567",
    });
    expect(parsed.manager_phone).toBe("+972501234567");
  });
});

describe("branchSchema Single-session price", () => {
  it("is optional: left empty, the 10-Card rate applies", () => {
    expect(branchSchema.parse(BASE).single_session_price_ils).toBeNull();
    expect(branchSchema.parse({ ...BASE, single_session_price_ils: null }).single_session_price_ils).toBeNull();
  });

  it("takes a positive price and refuses zero or less", () => {
    expect(branchSchema.parse({ ...BASE, single_session_price_ils: 110 }).single_session_price_ils).toBe(110);
    expect(branchSchema.safeParse({ ...BASE, single_session_price_ils: 0 }).success).toBe(false);
  });
});
