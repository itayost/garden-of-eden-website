import { describe, it, expect } from "vitest";
import {
  csvRowSchema,
  normalizeCSVRow,
  columnMapping,
  roleMapping,
} from "../user-import";

describe("csvRowSchema", () => {
  it("passes with all valid fields", () => {
    const result = csvRowSchema.safeParse({
      name: "יוסי כהן",
      phone: "0501234567",
      role: "trainee",
      email: "yosi@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("passes with minimal fields (name + phone)", () => {
    const result = csvRowSchema.safeParse({
      name: "יוסי",
      phone: "0501234567",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe("trainee"); // default
    }
  });

  it("fails with missing name", () => {
    const result = csvRowSchema.safeParse({
      phone: "0501234567",
    });
    expect(result.success).toBe(false);
  });

  it("fails with name too short", () => {
    const result = csvRowSchema.safeParse({
      name: "א",
      phone: "0501234567",
    });
    expect(result.success).toBe(false);
  });

  it("fails with invalid phone", () => {
    const result = csvRowSchema.safeParse({
      name: "יוסי כהן",
      phone: "123",
    });
    expect(result.success).toBe(false);
  });

  it("accepts +972 phone format", () => {
    const result = csvRowSchema.safeParse({
      name: "יוסי כהן",
      phone: "+972501234567",
    });
    expect(result.success).toBe(true);
  });

  it("defaults role to trainee when omitted", () => {
    const result = csvRowSchema.safeParse({
      name: "יוסי כהן",
      phone: "0501234567",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe("trainee");
    }
  });

  it("accepts valid role values", () => {
    for (const role of ["trainee", "trainer", "admin"]) {
      const result = csvRowSchema.safeParse({
        name: "יוסי",
        phone: "0501234567",
        role,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid role", () => {
    const result = csvRowSchema.safeParse({
      name: "יוסי",
      phone: "0501234567",
      role: "superadmin",
    });
    expect(result.success).toBe(false);
  });

  it("transforms empty email string to undefined", () => {
    const result = csvRowSchema.safeParse({
      name: "יוסי כהן",
      phone: "0501234567",
      email: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBeUndefined();
    }
  });

  it("rejects invalid email", () => {
    const result = csvRowSchema.safeParse({
      name: "יוסי",
      phone: "0501234567",
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("contains Hebrew error messages", () => {
    const result = csvRowSchema.safeParse({
      name: "א",
      phone: "bad",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages.some((m) => /שם/.test(m) || /טלפון/.test(m))).toBe(true);
    }
  });
});

describe("normalizeCSVRow", () => {
  it("maps Hebrew column names to English", () => {
    const result = normalizeCSVRow({
      "שם": "יוסי",
      "טלפון": "0501234567",
      "תפקיד": "מתאמן",
    });
    expect(result.name).toBe("יוסי");
    expect(result.phone).toBe("0501234567");
    expect(result.role).toBe("trainee");
  });

  it("maps English column names", () => {
    const result = normalizeCSVRow({
      name: "Yosi",
      phone: "0501234567",
      role: "trainer",
    });
    expect(result.name).toBe("Yosi");
    expect(result.role).toBe("trainer");
  });

  it("maps Hebrew role names to English", () => {
    expect(
      normalizeCSVRow({ "תפקיד": "מאמן" }).role
    ).toBe("trainer");
    expect(
      normalizeCSVRow({ "תפקיד": "מנהל" }).role
    ).toBe("admin");
    expect(
      normalizeCSVRow({ "תפקיד": "מתאמן" }).role
    ).toBe("trainee");
  });

  it("trims whitespace from keys and values", () => {
    const result = normalizeCSVRow({
      "  name  ": "  יוסי כהן  ",
      " phone ": " 0501234567 ",
    });
    expect(result.name).toBe("יוסי כהן");
    expect(result.phone).toBe("0501234567");
  });

  it("handles empty values", () => {
    const result = normalizeCSVRow({
      name: "יוסי",
      email: "",
    });
    expect(result.email).toBe("");
  });
});

describe("columnMapping", () => {
  it("contains all Hebrew-English mappings", () => {
    expect(columnMapping["שם"]).toBe("name");
    expect(columnMapping["טלפון"]).toBe("phone");
    expect(columnMapping["תפקיד"]).toBe("role");
    expect(columnMapping["אימייל"]).toBe("email");
  });

  it("contains English self-mappings", () => {
    expect(columnMapping["name"]).toBe("name");
    expect(columnMapping["phone"]).toBe("phone");
    expect(columnMapping["role"]).toBe("role");
    expect(columnMapping["email"]).toBe("email");
  });
});

describe("roleMapping", () => {
  it("maps Hebrew roles to English", () => {
    expect(roleMapping["מתאמן"]).toBe("trainee");
    expect(roleMapping["מאמן"]).toBe("trainer");
    expect(roleMapping["מנהל"]).toBe("admin");
  });

  it("maps English roles to themselves", () => {
    expect(roleMapping["trainee"]).toBe("trainee");
    expect(roleMapping["trainer"]).toBe("trainer");
    expect(roleMapping["admin"]).toBe("admin");
  });
});
