import { normalizeLeadPhone, parseBirthYearInput } from "@/lib/validations/leads";

/** A lead row parsed from pasted spreadsheet text (header-mapped or positional). */
export interface ParsedLeadRow {
  readonly name: string;
  readonly phone: string | null;
  readonly note: string | null;
  readonly club: string | null;
  readonly birth_year: number | null;
  readonly is_from_haifa: boolean;
  readonly additional_info: string | null;
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

type FieldKey =
  | "name"
  | "phone"
  | "note"
  | "club"
  | "birth_year"
  | "is_from_haifa"
  | "additional_info";

/** Header aliases (Hebrew + English) → lead field. Compared after trim+lowercase. */
const HEADER_ALIASES: Record<string, FieldKey> = {
  // name
  "שם": "name",
  "שם מלא": "name",
  "שם פרטי": "name",
  "שם ושם משפחה": "name",
  "שם השחקן": "name",
  "שם מתאמן": "name",
  "שם לקוח": "name",
  name: "name",
  "full name": "name",
  fullname: "name",
  "first name": "name",
  firstname: "name",
  // phone (broad: silently dropping an unrecognised phone header was the bug
  // behind name-only leads, so accept every common Hebrew/English variant)
  "טלפון": "phone",
  "נייד": "phone",
  "מספר": "phone",
  "מספר טלפון": "phone",
  "מס' טלפון": "phone",
  "מס׳ טלפון": "phone",
  "מספר נייד": "phone",
  "פלאפון": "phone",
  "פלפון": "phone",
  "טל": "phone",
  "טל׳": "phone",
  "סלולרי": "phone",
  "סלולארי": "phone",
  phone: "phone",
  "phone number": "phone",
  mobile: "phone",
  cell: "phone",
  tel: "phone",
  telephone: "phone",
  // additional info
  "מידע נוסף": "additional_info",
  "מידע": "additional_info",
  "פרטים": "additional_info",
  "פרטים נוספים": "additional_info",
  "additional info": "additional_info",
  "additional information": "additional_info",
  info: "additional_info",
  extra: "additional_info",
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

/**
 * Column order assumed when the paste has NO recognisable header row, matching
 * the documented simple format: שם / טלפון / מידע נוסף.
 */
const POSITIONAL_FIELDS: readonly FieldKey[] = ["name", "phone", "additional_info"];

function normalizeHeaderCell(cell: string): string {
  return cell.trim().replace(/^["']|["']$/g, "").toLowerCase();
}

/**
 * Parse a pasted spreadsheet of leads.
 *
 * Two input shapes are supported:
 * - With a header row: when row 1 contains a recognised `name` column, columns
 *   are detected by header name (Hebrew/English) in any order.
 * - Without such a header: rows are read positionally as שם / טלפון / מידע נוסף.
 *
 * Returns the valid rows plus per-line errors.
 */
export function parseLeadsPaste(input: string): ParseLeadsResult {
  const valid: ParsedLeadRow[] = [];
  const errors: ParseLeadError[] = [];

  const rawLines = input.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (rawLines.length === 0) return { valid, errors };

  // Tab-separated (Google Sheets default). Fall back to comma only when no line
  // contains a tab — guards a single-column header sitting above tabbed data.
  const sep = rawLines.some((l) => l.includes("\t")) ? "\t" : ",";

  const headerCells = rawLines[0].split(sep).map(normalizeHeaderCell);
  const mappedHeader = headerCells.map((h) => HEADER_ALIASES[h] ?? null);

  // Header mode is used only when row 1 has a recognised NAME column. Requiring
  // an explicit name header (rather than "any recognised alias") prevents a real
  // data row whose first cell happens to equal an alias word — e.g. the common
  // name "טל", which is also a phone alias — from being silently swallowed as a
  // header. Everything else is read positionally as name / phone / additional_info,
  // so a row is never dropped without feedback. Both branches always include a
  // name column, so there is no "missing name column" failure path.
  const hasNameHeader = mappedHeader.includes("name");

  const columns: (FieldKey | null)[] = hasNameHeader
    ? mappedHeader
    : [...POSITIONAL_FIELDS];
  const dataStartIndex = hasNameHeader ? 1 : 0;

  for (let i = dataStartIndex; i < rawLines.length; i++) {
    const rawLine = rawLines[i];
    const lineNumber = i + 1; // 1-based; in header mode row 1 is the header
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
    const additional_info = get("additional_info") || null;
    const club = get("club") || null;
    // Drop an out-of-range year rather than failing the whole row on the
    // server's birth_year (1990–2030) validation.
    const parsedYear = parseBirthYearInput(get("birth_year"));
    const birth_year =
      parsedYear !== null && parsedYear >= 1990 && parsedYear <= 2030
        ? parsedYear
        : null;
    const is_from_haifa = TRUTHY.has(get("is_from_haifa").toLowerCase());

    valid.push({ name, phone, note, club, birth_year, is_from_haifa, additional_info });
  }

  return { valid, errors };
}
