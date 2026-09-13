import { describe, expect, it } from "vitest";
import { userCreateSchema } from "../user-create";

const BASE = {
  full_name: "יוסי כהן",
  role: "trainee" as const,
  branch_ids: [],
};

describe("userCreateSchema phone handling", () => {
  it("accepts local, E.164, bare Auth, and punctuated phones as canonical E.164", () => {
    for (const phone of [
      "0501234567",
      "+972501234567",
      "972501234567",
      "050-123-4567",
    ]) {
      const result = userCreateSchema.safeParse({ ...BASE, phone });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.phone).toBe("+972501234567");
    }
  });
});
