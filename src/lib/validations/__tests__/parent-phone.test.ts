import { describe, expect, it } from "vitest";
import { parentPhoneSchema } from "../parent-phone";

describe("parentPhoneSchema", () => {
  it("normalizes a local number to E.164", () => {
    expect(parentPhoneSchema.parse({ phone: "0501234567" }).phone).toBe("+972501234567");
  });

  it("refuses a short or empty number", () => {
    expect(parentPhoneSchema.safeParse({ phone: "123" }).success).toBe(false);
    expect(parentPhoneSchema.safeParse({ phone: "" }).success).toBe(false);
  });
});
