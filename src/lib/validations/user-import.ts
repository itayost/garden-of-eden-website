import { z } from "zod";

// Phone validation (Israeli format: 0XX or +972XX)
const phoneRegex = /^0\d{9}$|^\+972\d{9}$/;

// Role options (same as user-create.ts)
const userRoles = ["trainee", "trainer", "admin"] as const;

/**
 * Schema for validating CSV import rows
 *
 * Columns:
 * - name / שם: Required, min 2 chars
 * - phone / טלפון: Required, Israeli format
 * - role / תפקיד: Optional, defaults to trainee
 */
export const csvRowSchema = z.object({
  name: z
    .string()
    .min(2, "שם חייב להכיל לפחות 2 תווים")
    .max(100, "שם ארוך מדי"),

  phone: z
    .string()
    .regex(phoneRegex, "מספר טלפון לא תקין (פורמט: 0501234567 או +972501234567)"),

  role: z
    .enum(userRoles, { message: "תפקיד לא תקין" })
    .default("trainee"),
});

export type CSVUserRow = z.infer<typeof csvRowSchema>;

/**
 * Result of validating CSV rows
 */
export interface CSVValidationResult {
  /** Successfully validated rows */
  valid: CSVUserRow[];
  /** Rows that failed validation */
  errors: Array<{
    /** 1-based row number (accounting for header) */
    row: number;
    /** Original row data */
    data: Record<string, string>;
    /** Validation error messages */
    errors: string[];
  }>;
}

/**
 * Map Hebrew column names to English
 */
export const columnMapping: Record<string, string> = {
  "שם": "name",
  "טלפון": "phone",
  "תפקיד": "role",
  // English names map to themselves
  "name": "name",
  "phone": "phone",
  "role": "role",
};

/**
 * Map role names (Hebrew to English)
 */
export const roleMapping: Record<string, string> = {
  "מתאמן": "trainee",
  "מאמן": "trainer",
  "מנהל": "admin",
  // English names map to themselves
  "trainee": "trainee",
  "trainer": "trainer",
  "admin": "admin",
};

/**
 * Normalize a CSV row by mapping column names and role values
 */
export function normalizeCSVRow(rawRow: Record<string, string>): Record<string, string> {
  const normalized: Record<string, string> = {};

  // Map column names
  for (const [key, value] of Object.entries(rawRow)) {
    const normalizedKey = columnMapping[key.trim().toLowerCase()] || key.trim().toLowerCase();
    normalized[normalizedKey] = value?.trim() || "";
  }

  // Map role value if present
  if (normalized.role) {
    normalized.role = roleMapping[normalized.role.trim()] || normalized.role.trim();
  }

  return normalized;
}
