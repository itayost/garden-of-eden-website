import { normalizeLeadPhone, parseBirthYearInput } from "@/lib/validations/leads";

/** A lead row parsed from pasted spreadsheet text (header-mapped). */
export interface ParsedLeadRow {
  readonly name: string;
  readonly phone: string | null;
  readonly note: string | null;
  readonly club: string | null;
  readonly birth_year: number | null;
  readonly is_from_haifa: boolean;
}

export interface ParseLeadError {
  readonly line: number;
  readonly raw: string;
  readonly message: string;
}

export interface ParseLeadsResult {
  readonly valid: readonly ParsedLeadRow[];
  readonly errors: readonly ParseLeadError[];
}

type FieldKey = "name" | "phone" | "note" | "club" | "birth_year" | "is_from_haifa";

/** Header aliases (Hebrew + English) → lead field. Compared after trim+lowercase. */
const HEADER_ALIASES: Record<string, FieldKey> = {
  // name
  "שם": "name",
  "שם מלא": "name",
  "שם השחקן": "name",
  "שם מתאמן": "name",
  name: "name",
  "full name": "name",
  // phone
  "טלפון": "phone",
  "נייד": "phone",
  "מספר": "phone",
  "מספר טלפון": "phone",
  phone: "phone",
  mobile: "phone",
  // note
  "הערה": "note",
  "הערות": "note",
  note: "note",
  notes: "note",
  // club
  "מועדון": "club",
  club: "club",
  // birth year
  "שנתון": "birth_year",
  "שנת לידה": "birth_year",
  year: "birth_year",
  "birth year": "birth_year",
  birthyear: "birth_year",
  // from haifa
  "חיפה": "is_from_haifa",
  "מחיפה": "is_from_haifa",
  haifa: "is_from_haifa",
};

const TRUTHY = new Set(["כן", "yes", "true", "1", "v", "✓"]);

function normalizeHeaderCell(cell: string): string {
  return cell.trim().replace(/^["']|["']$/g, "").toLowerCase();
}

/**
 * Parse a pasted spreadsheet of leads. The first non-empty line is a HEADER row;
 * columns are detected by name (Hebrew/English) in any order. Returns the valid
 * rows plus per-line errors. A `name` column is required.
 */
export function parseLeadsPaste(input: string): ParseLeadsResult {
  const valid: ParsedLeadRow[] = [];
  const errors: ParseLeadError[] = [];

  const rawLines = input.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (rawLines.length === 0) return { valid, errors };

  const headerLine = rawLines[0];
  // Tab-separated (Google Sheets default) unless the header only has commas.
  const sep = headerLine.includes("\t") ? "\t" : ",";

  const headerCells = headerLine.split(sep).map(normalizeHeaderCell);
  const columns: (FieldKey | null)[] = headerCells.map(
    (h) => HEADER_ALIASES[h] ?? null,
  );

  if (!columns.includes("name")) {
    errors.push({
      line: 1,
      raw: headerLine,
      message: "לא זוהתה עמודת שם בשורת הכותרת",
    });
    return { valid, errors };
  }

  for (let i = 1; i < rawLines.length; i++) {
    const rawLine = rawLines[i];
    const lineNumber = i + 1; // 1-based; row 1 is the header
    const cells = rawLine.split(sep);

    const get = (key: FieldKey): string => {
      const idx = columns.indexOf(key);
      return idx >= 0 && idx < cells.length ? cells[idx].trim() : "";
    };

    const name = get("name");
    if (name.length < 2) {
      errors.push({ line: lineNumber, raw: rawLine, message: "חסר שם או שם קצר מדי" });
      continue;
    }

    const phoneRaw = get("phone");
    let phone: string | null = null;
    if (phoneRaw !== "") {
      phone = normalizeLeadPhone(phoneRaw);
      if (!phone) {
        errors.push({ line: lineNumber, raw: rawLine, message: "טלפון לא תקין" });
        continue;
      }
    }

    const note = get("note") || null;
    const club = get("club") || null;
    const birth_year = parseBirthYearInput(get("birth_year"));
    const is_from_haifa = TRUTHY.has(get("is_from_haifa").toLowerCase());

    valid.push({ name, phone, note, club, birth_year, is_from_haifa });
  }

  return { valid, errors };
}
