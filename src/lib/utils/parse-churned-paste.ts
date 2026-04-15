import { isValidDateString } from "@/lib/validations/common";

export interface ParsedChurnedRow {
  readonly name: string;
  readonly endDate: string;
}

export interface ParseChurnedError {
  readonly line: number;
  readonly raw: string;
  readonly message: string;
}

export interface ParseChurnedResult {
  readonly valid: readonly ParsedChurnedRow[];
  readonly errors: readonly ParseChurnedError[];
}

/**
 * Parses a pasted block of lines, each "name<tab or comma>date".
 * Accepted date formats: dd/mm/yyyy, yyyy-mm-dd, dd.mm.yyyy.
 * Returns valid rows and per-line error info.
 */
export function parseChurnedPaste(input: string): ParseChurnedResult {
  const valid: ParsedChurnedRow[] = [];
  const errors: ParseChurnedError[] = [];

  const lines = input.split(/\r?\n/);
  let lineNumber = 0;
  for (const rawLine of lines) {
    if (rawLine.trim() === "") continue;
    lineNumber++;

    const separatorMatch = rawLine.match(/[\t,]/);
    if (!separatorMatch) {
      errors.push({
        line: lineNumber,
        raw: rawLine,
        message: "חסר תאריך סיום",
      });
      continue;
    }

    const sep = separatorMatch[0];
    const idx = rawLine.indexOf(sep);
    const name = rawLine.slice(0, idx).trim();
    const dateRaw = rawLine.slice(idx + 1).trim();

    if (name === "") {
      errors.push({ line: lineNumber, raw: rawLine, message: "חסר שם" });
      continue;
    }

    const normalized = normalizeDate(dateRaw);
    if (!normalized) {
      errors.push({
        line: lineNumber,
        raw: rawLine,
        message: "תאריך לא תקין",
      });
      continue;
    }

    valid.push({ name, endDate: normalized });
  }

  return { valid, errors };
}

function normalizeDate(value: string): string | null {
  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return isValidDateString(value) ? value : null;
  }

  // dd/mm/yyyy or dd.mm.yyyy
  const match = value.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})$/);
  if (!match) return null;
  const [, dayStr, monthStr, yearStr] = match;
  const day = dayStr.padStart(2, "0");
  const month = monthStr.padStart(2, "0");
  const iso = `${yearStr}-${month}-${day}`;
  return isValidDateString(iso) ? iso : null;
}
