import { describe, it, expect } from "vitest";
import {
  createChurnedCustomerSchema,
  updateChurnedCustomerSchema,
  bulkRowSchema,
  NOTE_COLORS,
} from "../churned-customers";

describe("createChurnedCustomerSchema", () => {
  it("accepts a valid minimal input", () => {
    const result = createChurnedCustomerSchema.safeParse({
      name: "דני כהן",
      endDate: "2026-04-01",
    });
    expect(result.success).toBe(true);
  });

  it("accepts full input with note and color", () => {
    const result = createChurnedCustomerSchema.safeParse({
      name: "דני כהן",
      endDate: "2026-04-01",
      note: "חזר בקשר",
      noteColor: "yellow",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = createChurnedCustomerSchema.safeParse({
      name: "   ",
      endDate: "2026-04-01",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid date format", () => {
    const result = createChurnedCustomerSchema.safeParse({
      name: "דני",
      endDate: "01/04/2026",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid note color", () => {
    const result = createChurnedCustomerSchema.safeParse({
      name: "דני",
      endDate: "2026-04-01",
      noteColor: "blue",
    });
    expect(result.success).toBe(false);
  });

  it("rejects name over 200 chars", () => {
    const result = createChurnedCustomerSchema.safeParse({
      name: "א".repeat(201),
      endDate: "2026-04-01",
    });
    expect(result.success).toBe(false);
  });

  it("rejects note over 2000 chars", () => {
    const result = createChurnedCustomerSchema.safeParse({
      name: "דני",
      endDate: "2026-04-01",
      note: "א".repeat(2001),
    });
    expect(result.success).toBe(false);
  });
});

describe("updateChurnedCustomerSchema", () => {
  it("accepts a partial update", () => {
    const result = updateChurnedCustomerSchema.safeParse({
      note: "new note",
      noteColor: "red",
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty object", () => {
    const result = updateChurnedCustomerSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe("bulkRowSchema", () => {
  it("accepts a valid row", () => {
    const result = bulkRowSchema.safeParse({
      name: "דני",
      endDate: "2026-04-01",
    });
    expect(result.success).toBe(true);
  });
});

describe("NOTE_COLORS", () => {
  it("lists the four allowed colors", () => {
    expect(NOTE_COLORS).toEqual(["none", "yellow", "red", "green"]);
  });
});
