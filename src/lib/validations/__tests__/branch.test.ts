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
