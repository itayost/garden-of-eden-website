# Assessment CSV Bulk Import Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import 7 historical assessment CSV files (9 logical sections, 4 formats) into `player_assessments` via a two-phase extract-then-import pipeline with human review.

**Architecture:** Extract shared utilities from existing `scripts/import-assessments.ts` into `scripts/import-utils.ts`. Build `scripts/extract-assessments.ts` (Phase 1) with 4 format-specific parsers that output `mapping.csv`. Build `scripts/import-from-mapping.ts` (Phase 2) that reads reviewed mapping and inserts into Supabase.

**Tech Stack:** TypeScript, tsx runner, Supabase admin client (service role key), CSV parsing, Vitest for utility tests.

**Spec:** `docs/superpowers/specs/2026-03-13-assessment-csv-import-design.md`

---

## Chunk 1: Shared Utilities

### Task 1: Extract shared utilities into `scripts/import-utils.ts`

**Files:**

- Create: `scripts/import-utils.ts`
- Modify: `scripts/import-assessments.ts` (update to import from utils)
- Test: `scripts/__tests__/import-utils.test.ts`

- [ ] **Step 1: Create `scripts/import-utils.ts` with env loader and admin client**

Extract from `scripts/import-assessments.ts` lines 27-88. Copy these functions:

```typescript
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Load .env.local
// ---------------------------------------------------------------------------
export function loadEnvLocal(): void {
  const envPath = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      val = val.replace(/\\n$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

// ---------------------------------------------------------------------------
// Supabase admin client
// ---------------------------------------------------------------------------
export function getAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
```

- [ ] **Step 2: Add CSV line parser to `scripts/import-utils.ts`**

Copy `parseCSVLine` from `scripts/import-assessments.ts` lines 108-124:

```typescript
export function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}
```

- [ ] **Step 3: Add numeric extraction utilities to `scripts/import-utils.ts`**

Copy `extractNumber` and `normalizeToCm` from lines 163-188. Then add sprint normalization:

```typescript
export function extractNumber(value: string): number | null {
  if (!value || value === "??" || value === "?" || value === "0") return null;
  let cleaned = value.replace(/[^\d.,\-]/g, "").trim();
  if (cleaned.includes(",") && !cleaned.includes(".")) {
    const parts = cleaned.split(",");
    if (parts.length === 2 && parts[1].length <= 3) {
      cleaned = parts.join(".");
    }
  }
  const num = parseFloat(cleaned);
  if (isNaN(num) || num === 0) return null;
  return num;
}

export function normalizeToCm(value: number): number {
  if (value < 10) {
    return Math.round(value * 100 * 10) / 10;
  }
  return value;
}

export function normalizeSprint(value: number): { result: number; warning: string | null } {
  if (value > 30) {
    return { result: value / 100, warning: `sprint=${value} -> ${value / 100} (auto-corrected)` };
  }
  if (value < 0.5 || value > 5) {
    return { result: value, warning: `sprint=${value} outside expected range 0.5-5.0s` };
  }
  return { result: value, warning: null };
}
```

- [ ] **Step 4: Add kaiser/height parser with % precedence to `scripts/import-utils.ts`**

Updated version of `parseKaiserJumpHeight` and `parseKaiserKickPower` per spec. The `%` marker takes precedence over magnitude threshold:

```typescript
export interface KaiserHeightResult {
  jumpHeight: number | null;
  kickPower: number | null;
}

export function parseKaiserHeight(value: string): KaiserHeightResult {
  if (!value) return { jumpHeight: null, kickPower: null };

  // Step 1: Extract %-marked number as kick power (any magnitude)
  let kickPower: number | null = null;
  const percentMatch = value.match(/(\d+)\s*%/);
  if (percentMatch) {
    kickPower = parseInt(percentMatch[1], 10) || null;
  }

  // Step 2: Find all numbers, exclude the one used for kick power
  const allNumbers = value.match(/\d+/g);
  if (!allNumbers) return { jumpHeight: null, kickPower };

  const kickPowerStr = percentMatch ? percentMatch[1] : null;
  let usedKickPowerIndex = -1;

  // Find the index of the kick power number to exclude it
  if (kickPowerStr) {
    const percentIndex = value.indexOf(percentMatch![0]);
    // The number closest to the % sign
    usedKickPowerIndex = allNumbers.findIndex((n, i) => {
      const nIndex = value.indexOf(n);
      return n === kickPowerStr && nIndex < percentIndex + percentMatch![0].length;
    });
  }

  const heightCandidates = allNumbers
    .filter((_, i) => i !== usedKickPowerIndex)
    .map(Number)
    .filter((n) => n > 20);

  const jumpHeight = heightCandidates.length > 0 ? Math.max(...heightCandidates) : null;

  return { jumpHeight, kickPower };
}
```

- [ ] **Step 5: Add single-leg jump parser to `scripts/import-utils.ts`**

Copy `parseSingleLegJump` and its `LegJumps` interface from lines 194-282 of `scripts/import-assessments.ts`. No changes needed -- the existing logic handles all observed patterns.

```typescript
export interface LegJumps {
  right: number | null;
  left: number | null;
}

export function parseSingleLegJump(value: string): LegJumps {
  // ... (copy verbatim from import-assessments.ts lines 199-282)
}
```

- [ ] **Step 6: Add coordination, blaze spot, and name matching to `scripts/import-utils.ts`**

Copy these functions verbatim from `scripts/import-assessments.ts`:

- `mapCoordination` (lines 308-317)
- `parseBlazeSpot` (lines 323-328)
- `normalizeName` (lines 339-347)
- `findProfileMatch` (lines 349-389) -- but modify to also return `match_confidence`:

```typescript
export interface ProfileMatch {
  id: string;
  full_name: string;
}

export type MatchConfidence = "exact" | "partial" | "token" | "none";

export interface MatchResult {
  profile: ProfileMatch | null;
  confidence: MatchConfidence;
}

export function findProfileMatch(
  csvName: string,
  profiles: ProfileMatch[]
): MatchResult {
  const normalized = normalizeName(csvName);
  if (!normalized) return { profile: null, confidence: "none" };

  // Exact match
  const exact = profiles.find(
    (p) => p.full_name && normalizeName(p.full_name) === normalized
  );
  if (exact) return { profile: exact, confidence: "exact" };

  // Partial match
  const partial = profiles.find((p) => {
    if (!p.full_name) return false;
    const pNorm = normalizeName(p.full_name);
    return pNorm.includes(normalized) || normalized.includes(pNorm);
  });
  if (partial) return { profile: partial, confidence: "partial" };

  // Token overlap
  const csvTokens = normalized.split(" ").filter((t) => t.length > 1);
  let bestMatch: ProfileMatch | null = null;
  let bestScore = 0;
  for (const p of profiles) {
    if (!p.full_name) continue;
    const pTokens = normalizeName(p.full_name).split(" ").filter((t) => t.length > 1);
    const overlap = csvTokens.filter((t) => pTokens.includes(t)).length;
    const score = overlap / Math.max(csvTokens.length, pTokens.length);
    if (score > bestScore && score >= 0.5) {
      bestScore = score;
      bestMatch = p;
    }
  }
  if (bestMatch) return { profile: bestMatch, confidence: "token" };

  return { profile: null, confidence: "none" };
}
```

- [ ] **Step 7: Add the normalized assessment row type**

This is the common output format all parsers produce:

```typescript
export interface NormalizedAssessmentRow {
  source_file: string;
  csv_name: string;
  assessment_date: string;
  sprint_5m: number | null;
  sprint_10m: number | null;
  sprint_20m: number | null;
  jump_2leg_distance: number | null;
  jump_right_leg: number | null;
  jump_left_leg: number | null;
  jump_2leg_height: number | null;
  kick_power_kaiser: number | null;
  blaze_spot_time: number | null;
  coordination: "deficient" | "basic" | "advanced" | null;
  warnings: string[];
}
```

- [ ] **Step 8: Add `isHeaderOrMetadata` filter function**

```typescript
export function isHeaderOrMetadata(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length === 0) return true;
  if (["שם השחקן", "שם", "שם שחקן", "כ", "אי"].includes(trimmed)) return true;
  if (trimmed.startsWith("עמודה") || trimmed.startsWith("תשאירו")) return true;
  return false;
}
```

- [ ] **Step 9: Commit shared utilities**

```bash
git add scripts/import-utils.ts
git commit -m "feat(import): extract shared utilities into import-utils.ts"
```

### Task 2: Write tests for shared utilities

**Files:**

- Create: `scripts/__tests__/import-utils.test.ts`

- [ ] **Step 1: Write tests for `extractNumber`**

```typescript
import { describe, it, expect } from "vitest";
import {
  extractNumber,
  normalizeToCm,
  normalizeSprint,
  parseKaiserHeight,
  parseSingleLegJump,
  mapCoordination,
  parseBlazeSpot,
  normalizeName,
  findProfileMatch,
  isHeaderOrMetadata,
} from "../import-utils";

describe("extractNumber", () => {
  it("extracts plain number", () => {
    expect(extractNumber("1.23")).toBe(1.23);
  });
  it("handles comma decimal separator", () => {
    expect(extractNumber("1,23")).toBe(1.23);
  });
  it("strips Hebrew text", () => {
    expect(extractNumber("188 7%")).toBe(188);
  });
  it("returns null for ?", () => {
    expect(extractNumber("?")).toBeNull();
  });
  it("returns null for ??", () => {
    expect(extractNumber("??")).toBeNull();
  });
  it("returns null for 0", () => {
    expect(extractNumber("0")).toBeNull();
  });
  it("returns null for empty", () => {
    expect(extractNumber("")).toBeNull();
  });
});
```

- [ ] **Step 2: Write tests for `parseKaiserHeight`**

```typescript
describe("parseKaiserHeight", () => {
  it("splits 188 7% into height=188, kaiser=7", () => {
    const result = parseKaiserHeight("188 7%");
    expect(result.jumpHeight).toBe(188);
    expect(result.kickPower).toBe(7);
  });
  it("handles 204 7%", () => {
    const result = parseKaiserHeight("204 7%");
    expect(result.jumpHeight).toBe(204);
    expect(result.kickPower).toBe(7);
  });
  it("handles 83 3%", () => {
    const result = parseKaiserHeight("83 3%");
    expect(result.jumpHeight).toBe(83);
    expect(result.kickPower).toBe(3);
  });
  it("handles 230% (% overrides magnitude threshold)", () => {
    const result = parseKaiserHeight("230%");
    expect(result.jumpHeight).toBeNull();
    expect(result.kickPower).toBe(230);
  });
  it("handles 65% (standalone percentage)", () => {
    const result = parseKaiserHeight("65%");
    expect(result.jumpHeight).toBeNull();
    expect(result.kickPower).toBe(65);
  });
  it("handles plain number > 20 as height only", () => {
    const result = parseKaiserHeight("150");
    expect(result.jumpHeight).toBe(150);
    expect(result.kickPower).toBeNull();
  });
  it("handles empty string", () => {
    const result = parseKaiserHeight("");
    expect(result.jumpHeight).toBeNull();
    expect(result.kickPower).toBeNull();
  });
  it("handles 5- 124 pattern (platform height)", () => {
    const result = parseKaiserHeight("5- 124");
    expect(result.jumpHeight).toBe(124);
  });
  it("handles 84 3% with space", () => {
    const result = parseKaiserHeight("84 3%");
    expect(result.jumpHeight).toBe(84);
    expect(result.kickPower).toBe(3);
  });
  it("handles 7% 239 (reversed order)", () => {
    const result = parseKaiserHeight("7% 239");
    expect(result.jumpHeight).toBe(239);
    expect(result.kickPower).toBe(7);
  });
});
```

- [ ] **Step 3: Write tests for other utility functions**

```typescript
describe("normalizeToCm", () => {
  it("converts meters to cm for values < 10", () => {
    expect(normalizeToCm(1.97)).toBe(197);
  });
  it("leaves cm values unchanged", () => {
    expect(normalizeToCm(150)).toBe(150);
  });
});

describe("normalizeSprint", () => {
  it("auto-corrects values > 30 by dividing by 100", () => {
    expect(normalizeSprint(240).result).toBe(2.4);
    expect(normalizeSprint(240).warning).toContain("auto-corrected");
  });
  it("passes through normal values", () => {
    expect(normalizeSprint(1.23).result).toBe(1.23);
    expect(normalizeSprint(1.23).warning).toBeNull();
  });
});

describe("mapCoordination", () => {
  it("maps 1 to deficient", () => {
    expect(mapCoordination("1")).toBe("deficient");
  });
  it("maps 2-3 to basic", () => {
    expect(mapCoordination("2")).toBe("basic");
    expect(mapCoordination("3")).toBe("basic");
  });
  it("maps 4-5 to advanced", () => {
    expect(mapCoordination("4")).toBe("advanced");
    expect(mapCoordination("5")).toBe("advanced");
  });
  it("returns null for 0", () => {
    expect(mapCoordination("0")).toBeNull();
  });
});

describe("parseBlazeSpot", () => {
  it("extracts integer from plain number", () => {
    expect(parseBlazeSpot("38")).toBe(38);
  });
  it("extracts from text like '38 חצי דקה'", () => {
    expect(parseBlazeSpot("38 חצי דקה")).toBe(38);
  });
  it("returns null for empty", () => {
    expect(parseBlazeSpot("")).toBeNull();
  });
});

describe("isHeaderOrMetadata", () => {
  it("identifies Hebrew headers", () => {
    expect(isHeaderOrMetadata("שם השחקן")).toBe(true);
    expect(isHeaderOrMetadata("שם")).toBe(true);
    expect(isHeaderOrMetadata("כ")).toBe(true);
  });
  it("identifies metadata rows", () => {
    expect(isHeaderOrMetadata("תשאירו שורה ריקה")).toBe(true);
  });
  it("allows regular names", () => {
    expect(isHeaderOrMetadata("איתי בן דוד")).toBe(false);
  });
  it("filters empty strings", () => {
    expect(isHeaderOrMetadata("")).toBe(true);
  });
});

describe("findProfileMatch", () => {
  const profiles = [
    { id: "1", full_name: "איתי בן דוד" },
    { id: "2", full_name: "נועם קופלוביץ" },
    { id: "3", full_name: "רועי זהבי" },
  ];

  it("finds exact match", () => {
    const result = findProfileMatch("איתי בן דוד", profiles);
    expect(result.confidence).toBe("exact");
    expect(result.profile?.id).toBe("1");
  });
  it("finds partial match", () => {
    const result = findProfileMatch("איתי בן דוד ", profiles);
    expect(result.profile?.id).toBe("1");
  });
  it("finds token match with typo", () => {
    const result = findProfileMatch("נועם קופליביץ", profiles);
    expect(result.confidence).toBe("token");
    expect(result.profile?.id).toBe("2");
  });
  it("returns none for unmatched name", () => {
    const result = findProfileMatch("זוזו", profiles);
    expect(result.confidence).toBe("none");
    expect(result.profile).toBeNull();
  });
});
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run scripts/__tests__/import-utils.test.ts`
Expected: All tests pass.

- [ ] **Step 5: Commit tests**

```bash
git add scripts/__tests__/import-utils.test.ts
git commit -m "test(import): add unit tests for import utility functions"
```

### Task 3: Update existing `import-assessments.ts` to use shared utils

**Files:**

- Modify: `scripts/import-assessments.ts`

- [ ] **Step 1: Replace duplicated code with imports**

At the top of `scripts/import-assessments.ts`, replace the inline implementations with imports from `import-utils.ts`:

```typescript
import {
  loadEnvLocal,
  getAdminClient,
  parseCSVLine,
  extractNumber,
  normalizeToCm,
  parseSingleLegJump,
  parseKaiserHeight,
  mapCoordination,
  parseBlazeSpot,
  normalizeName,
  findProfileMatch,
  isHeaderOrMetadata,
  type LegJumps,
  type ProfileMatch,
} from "./import-utils";
```

Remove all the duplicated function definitions (lines 27-389). Keep only: CLI args parsing, `CsvRow` interface, `parseCsv`, `buildAssessmentData`, report functions, and `main()`.

Update `buildAssessmentData` to use `parseKaiserHeight` instead of separate `parseKaiserJumpHeight`/`parseKaiserKickPower`:

```typescript
const kaiser = parseKaiserHeight(row.kaiserHeight);
// ...
jump_2leg_height: kaiser.jumpHeight,
kick_power_kaiser: kaiser.kickPower,
```

Update `parseCsv` to use `isHeaderOrMetadata` for the filter.

Update `findProfileMatch` call sites to destructure `{ profile, confidence }` and use `profile` where `match` was used.

Add `loadEnvLocal()` call at top-level (replacing inline env loading).

- [ ] **Step 2: Verify existing script still works**

Run: `npx tsx scripts/import-assessments.ts "assesments-to-import/מבדקים כדורגלנים - אוקטובר.csv" 2024-10-01 --dry-run`
Expected: Same output as before (matched players, no errors).

- [ ] **Step 3: Commit**

```bash
git add scripts/import-assessments.ts
git commit -m "refactor(import): use shared utilities from import-utils.ts"
```

---

## Chunk 2: Format-Specific Parsers

### Task 4: Add `parseStandardColumnar` parser

**Files:**

- Modify: `scripts/import-utils.ts`
- Test: `scripts/__tests__/import-utils.test.ts`

- [ ] **Step 1: Write test for `parseStandardColumnar`**

Add to `scripts/__tests__/import-utils.test.ts`:

```typescript
import { parseStandardColumnar } from "../import-utils";

describe("parseStandardColumnar", () => {
  it("parses standard row with all fields", () => {
    const lines = [
      "שם השחקן,ניתור שיא לגובה,ניתור 2 רגליים,ניתור רגל אחת,5 מטר,10 מטר,גמישות,יציבות,קואורדינציה,טכניקת ריצה,חשיבה מהירה",
      "איתי בן דוד,204 7%,2.35,רגל ימין 2.30 - רגל שמאל 2.35,0.86,1.66,0,0,0,0,",
    ];
    const content = lines.join("\n");
    const result = parseStandardColumnar(content, "test.csv", "2024-08-01");
    expect(result).toHaveLength(1);
    expect(result[0].csv_name).toBe("איתי בן דוד");
    expect(result[0].sprint_5m).toBe(0.86);
    expect(result[0].sprint_10m).toBe(1.66);
    expect(result[0].jump_2leg_distance).toBe(235);
    expect(result[0].jump_2leg_height).toBe(204);
    expect(result[0].kick_power_kaiser).toBe(7);
  });

  it("filters header and empty rows", () => {
    const lines = [
      "שם השחקן,col1,col2,col3,col4,col5,col6,col7,col8,col9,col10",
      "שם שחקן,,,,,,,,,,,",
      ",,,,,,,,,,",
      "איתי,,,,,,,,,,,",
    ];
    const result = parseStandardColumnar(lines.join("\n"), "test.csv", "2024-07-01");
    expect(result).toHaveLength(1);
    expect(result[0].csv_name).toBe("איתי");
  });

  it("auto-corrects sprint > 30", () => {
    const lines = [
      "שם,col1,col2,col3,col4,col5,col6,col7,col8,col9,col10",
      "player,,,,1.27,240,,,,,,",
    ];
    const result = parseStandardColumnar(lines.join("\n"), "test.csv", "2024-03-01");
    expect(result[0].sprint_10m).toBe(2.4);
    expect(result[0].warnings).toEqual(expect.arrayContaining([expect.stringContaining("auto-corrected")]));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/__tests__/import-utils.test.ts -t "parseStandardColumnar"`
Expected: FAIL -- `parseStandardColumnar` not exported.

- [ ] **Step 3: Implement `parseStandardColumnar` in `scripts/import-utils.ts`**

```typescript
export function parseStandardColumnar(
  content: string,
  sourceFile: string,
  assessmentDate: string
): NormalizedAssessmentRow[] {
  const lines = content.split("\n");
  const dataLines = lines.slice(1); // skip header
  const results: NormalizedAssessmentRow[] = [];

  for (const line of dataLines) {
    const fields = parseCSVLine(line);
    const name = (fields[0] || "").trim();
    if (isHeaderOrMetadata(name)) continue;

    const warnings: string[] = [];

    // Sprints
    let sprint5m = extractNumber(fields[4] || "");
    if (sprint5m !== null) {
      const s = normalizeSprint(sprint5m);
      sprint5m = s.result;
      if (s.warning) warnings.push(s.warning);
    }

    let sprint10m = extractNumber(fields[5] || "");
    if (sprint10m !== null) {
      const s = normalizeSprint(sprint10m);
      sprint10m = s.result;
      if (s.warning) warnings.push(s.warning);
    }

    // 2-leg jump distance
    const rawDistance = extractNumber(fields[2] || "");
    const jump2legDistance = rawDistance !== null ? normalizeToCm(rawDistance) : null;

    // Single-leg jumps
    const legJumps = parseSingleLegJump(fields[3] || "");

    // Kaiser/Height
    const kaiser = parseKaiserHeight(fields[1] || "");

    // Blaze spot
    const blazeSpot = parseBlazeSpot(fields[10] || "");

    // Coordination
    const coordination = mapCoordination(fields[8] || "");

    results.push({
      source_file: sourceFile,
      csv_name: name,
      assessment_date: assessmentDate,
      sprint_5m: sprint5m,
      sprint_10m: sprint10m,
      sprint_20m: null,
      jump_2leg_distance: jump2legDistance,
      jump_right_leg: legJumps.right,
      jump_left_leg: legJumps.left,
      jump_2leg_height: kaiser.jumpHeight,
      kick_power_kaiser: kaiser.kickPower,
      blaze_spot_time: blazeSpot,
      coordination,
      warnings,
    });
  }

  return results;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run scripts/__tests__/import-utils.test.ts -t "parseStandardColumnar"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/import-utils.ts scripts/__tests__/import-utils.test.ts
git commit -m "feat(import): add parseStandardColumnar parser"
```

### Task 5: Add `parseReorderedColumnar` parser

**Files:**

- Modify: `scripts/import-utils.ts`
- Modify: `scripts/__tests__/import-utils.test.ts`

- [ ] **Step 1: Write test for `parseReorderedColumnar`**

```typescript
describe("parseReorderedColumnar", () => {
  it("maps columns by header keywords", () => {
    const lines = [
      "אי,ניתור שיא לגובה,ניתור רגל ימין למרחק, 30 שניות בלייז ספוט,ניתור 2 רגליים למרחק,ניתור רגל שאמאל למרחק,מהירות שיא 5 מטר,מהירות שיא 10 מטר קו ישר,גמישות,יציבות,קואורדינציה,טכניקת ריצה, זריזות מהירות אלכסונים 10 מטר,זריזות מהירות אלכסונים 5 מטר",
      'לואי כאוכב,83%,1.38,33,,1.48,"1,05","2,08",0,0,0,0,8.75,3.92',
    ];
    const result = parseReorderedColumnar(lines.join("\n"), "nov.csv", "2024-11-01");
    expect(result).toHaveLength(1);
    expect(result[0].csv_name).toBe("לואי כאוכב");
    expect(result[0].kick_power_kaiser).toBe(83);
    expect(result[0].jump_right_leg).toBe(138);
    expect(result[0].blaze_spot_time).toBe(33);
    expect(result[0].jump_left_leg).toBe(148);
    expect(result[0].sprint_5m).toBe(1.05);
    expect(result[0].sprint_10m).toBe(2.08);
  });

  it("handles sub-table with two height columns", () => {
    const lines = [
      "שם,ניתור לגובה 3.5,ניתור לגובה 5,קפיצה למרחק 2 רגליים,קפיצה למרחק רגל ימין,קפיצה למרחק רגל שמאל,זריזות 4 פודים חצי דקה TO 1.25,ספרינט 5מ,ספרינט 10מ",
      "אייל סוויד,198,235,2.12,1.73,2,44,4.71,6.56",
    ];
    const result = parseReorderedColumnar(lines.join("\n"), "nov.csv", "2024-11-01");
    expect(result[0].jump_2leg_height).toBe(235); // uses "ניתור לגובה 5"
    expect(result[0].jump_2leg_distance).toBe(212);
    expect(result[0].blaze_spot_time).toBe(44);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/__tests__/import-utils.test.ts -t "parseReorderedColumnar"`
Expected: FAIL

- [ ] **Step 3: Implement `parseReorderedColumnar`**

```typescript
export function parseReorderedColumnar(
  content: string,
  sourceFile: string,
  assessmentDate: string
): NormalizedAssessmentRow[] {
  const lines = content.split("\n");
  if (lines.length === 0) return [];

  const headerFields = parseCSVLine(lines[0]);

  // Map column indices by header keywords
  const colMap: Record<string, number> = {};
  for (let i = 0; i < headerFields.length; i++) {
    const h = headerFields[i].trim();
    if (/ניתור רגל ימין|קפיצה למרחק רגל ימין/.test(h)) colMap.jumpRight = i;
    else if (/ניתור רגל.*שמ|קפיצה למרחק רגל שמאל/.test(h)) colMap.jumpLeft = i;
    else if (/בלייז ספוט|זריזות.*פודים/.test(h)) colMap.blazeSpot = i;
    else if (/ניתור 2 רגליים|קפיצה למרחק 2 רגליים/.test(h)) colMap.jump2leg = i;
    else if (/מהירות.*5|ספרינט 5/.test(h)) colMap.sprint5 = i;
    else if (/מהירות.*10|ספרינט 10/.test(h)) colMap.sprint10 = i;
    else if (/ניתור.*לגובה 5/.test(h)) colMap.height5 = i;
    else if (/ניתור.*לגובה 3/.test(h)) colMap.height35 = i;
    else if (/ניתור.*לגובה/.test(h) && colMap.height5 === undefined) colMap.heightGeneric = i;
  }

  const results: NormalizedAssessmentRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    const name = (fields[0] || "").trim();
    if (isHeaderOrMetadata(name)) continue;

    const warnings: string[] = [];

    // Sprints
    let sprint5m = colMap.sprint5 !== undefined ? extractNumber(fields[colMap.sprint5] || "") : null;
    if (sprint5m !== null) { const s = normalizeSprint(sprint5m); sprint5m = s.result; if (s.warning) warnings.push(s.warning); }

    let sprint10m = colMap.sprint10 !== undefined ? extractNumber(fields[colMap.sprint10] || "") : null;
    if (sprint10m !== null) { const s = normalizeSprint(sprint10m); sprint10m = s.result; if (s.warning) warnings.push(s.warning); }

    // Jump distance
    const rawDist = colMap.jump2leg !== undefined ? extractNumber(fields[colMap.jump2leg] || "") : null;
    const jump2legDist = rawDist !== null ? normalizeToCm(rawDist) : null;

    // Single-leg jumps (separate columns)
    const rawRight = colMap.jumpRight !== undefined ? extractNumber(fields[colMap.jumpRight] || "") : null;
    const rawLeft = colMap.jumpLeft !== undefined ? extractNumber(fields[colMap.jumpLeft] || "") : null;
    const jumpRight = rawRight !== null ? normalizeToCm(rawRight) : null;
    const jumpLeft = rawLeft !== null ? normalizeToCm(rawLeft) : null;

    // Height: prefer "5" column, fall back to generic
    const heightCol = colMap.height5 ?? colMap.heightGeneric;
    let jumpHeight: number | null = null;
    let kickPower: number | null = null;
    if (heightCol !== undefined) {
      const kaiser = parseKaiserHeight(fields[heightCol] || "");
      jumpHeight = kaiser.jumpHeight;
      kickPower = kaiser.kickPower;
    }

    // Blaze spot
    const blazeSpot = colMap.blazeSpot !== undefined ? parseBlazeSpot(fields[colMap.blazeSpot] || "") : null;

    results.push({
      source_file: sourceFile,
      csv_name: name,
      assessment_date: assessmentDate,
      sprint_5m: sprint5m,
      sprint_10m: sprint10m,
      sprint_20m: null,
      jump_2leg_distance: jump2legDist,
      jump_right_leg: jumpRight,
      jump_left_leg: jumpLeft,
      jump_2leg_height: jumpHeight,
      kick_power_kaiser: kickPower,
      blaze_spot_time: blazeSpot,
      coordination: null,
      warnings,
    });
  }

  return results;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run scripts/__tests__/import-utils.test.ts -t "parseReorderedColumnar"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/import-utils.ts scripts/__tests__/import-utils.test.ts
git commit -m "feat(import): add parseReorderedColumnar parser"
```

### Task 6: Add `parseVerticalCard` parser

**Files:**

- Modify: `scripts/import-utils.ts`
- Modify: `scripts/__tests__/import-utils.test.ts`

- [ ] **Step 1: Write test for `parseVerticalCard`**

```typescript
describe("parseVerticalCard", () => {
  it("parses vertical card with two attempts, takes best", () => {
    const content = [
      'יהב סיוון,,,,,,,,,,,,,',
      ',,,,,,,,,,,,,',
      '"5 מ - 5.32, 5.40",,,,,,,,,,,,,',
      '"10 מ - 7.58, 7.60",,,,,,,,,,,,,',
      '"קפיצה שתי רגליים - 2.27, 2.30",,,,,,,,,,,,,',
      '"שמאל - 2.00, 1.91",,,,,,,,,,,,,',
      '"ימין - 1.90, 2.10",,,,,,,,,,,,,',
    ].join("\n");
    const result = parseVerticalCard(content, "nov.csv", "2024-11-01");
    expect(result).toHaveLength(1);
    expect(result[0].csv_name).toBe("יהב סיוון");
    expect(result[0].sprint_5m).toBe(5.32); // lower is better
    expect(result[0].sprint_10m).toBe(7.58); // lower is better
    expect(result[0].jump_2leg_distance).toBe(230); // higher, normalized to cm
    expect(result[0].jump_left_leg).toBe(200); // higher
    expect(result[0].jump_right_leg).toBe(210); // higher
  });

  it("flushes last player at EOF", () => {
    const content = [
      'player name,,,,,,,,,,,,,',
      '"5 מ - 1.05, 1.10",,,,,,,,,,,,,',
    ].join("\n");
    const result = parseVerticalCard(content, "test.csv", "2024-11-01");
    expect(result).toHaveLength(1);
  });

  it("stores text notes in warnings", () => {
    const content = [
      'נועם בן דניו,,,,,,,,,,,,,',
      ',,,,,,,,,,,,,',
      '"קרסוליים קשיחות, לא הכי יציב, קושי בשינויי כיוון",,,,,,,,,,,,,',
      '"5 מ - 6.93, 6.61",,,,,,,,,,,,,',
      '"10 מ - 9.18, 9.35",,,,,,,,,,,,,',
    ].join("\n");
    const result = parseVerticalCard(content, "test.csv", "2024-11-01");
    expect(result[0].warnings).toEqual(expect.arrayContaining([
      expect.stringContaining("קרסוליים"),
    ]));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/__tests__/import-utils.test.ts -t "parseVerticalCard"`
Expected: FAIL

- [ ] **Step 3: Implement `parseVerticalCard`**

```typescript
export function parseVerticalCard(
  content: string,
  sourceFile: string,
  assessmentDate: string
): NormalizedAssessmentRow[] {
  const lines = content.split("\n");
  const results: NormalizedAssessmentRow[] = [];

  let currentName: string | null = null;
  let currentData: Partial<NormalizedAssessmentRow> = {};
  let currentWarnings: string[] = [];

  function flushPlayer() {
    if (currentName && !isHeaderOrMetadata(currentName)) {
      results.push({
        source_file: sourceFile,
        csv_name: currentName,
        assessment_date: assessmentDate,
        sprint_5m: currentData.sprint_5m ?? null,
        sprint_10m: currentData.sprint_10m ?? null,
        sprint_20m: null,
        jump_2leg_distance: currentData.jump_2leg_distance ?? null,
        jump_right_leg: currentData.jump_right_leg ?? null,
        jump_left_leg: currentData.jump_left_leg ?? null,
        jump_2leg_height: null,
        kick_power_kaiser: null,
        blaze_spot_time: null,
        coordination: null,
        warnings: currentWarnings,
      });
    }
    currentName = null;
    currentData = {};
    currentWarnings = [];
  }

  // Measurement line pattern: "label - N, N" or "label - N"
  const measurementPattern = /^"?(.+?)\s*-\s*([\d.]+)(?:\s*,\s*([\d.]+))?"?$/;

  for (const rawLine of lines) {
    const fields = parseCSVLine(rawLine);
    const cell = (fields[0] || "").trim();
    if (!cell) {
      // blank line -- could be separator between players or within a player block
      continue;
    }

    const match = cell.match(measurementPattern);
    if (match) {
      // This is a measurement line
      const label = match[1].trim();
      const val1 = parseFloat(match[2]);
      const val2 = match[3] ? parseFloat(match[3]) : null;

      if (/^5 מ/.test(label)) {
        // Sprint 5m -- lower is better
        currentData.sprint_5m = val2 !== null ? Math.min(val1, val2) : val1;
      } else if (/^10 מ/.test(label)) {
        // Sprint 10m -- lower is better
        currentData.sprint_10m = val2 !== null ? Math.min(val1, val2) : val1;
      } else if (/קפיצה שתי רגליים|שתי רגליים/.test(label)) {
        // 2-leg jump -- higher is better, normalize to cm
        const best = val2 !== null ? Math.max(val1, val2) : val1;
        currentData.jump_2leg_distance = normalizeToCm(best);
      } else if (/שמאל/.test(label)) {
        const best = val2 !== null ? Math.max(val1, val2) : val1;
        currentData.jump_left_leg = normalizeToCm(best);
      } else if (/ימין/.test(label)) {
        const best = val2 !== null ? Math.max(val1, val2) : val1;
        currentData.jump_right_leg = normalizeToCm(best);
      }
    } else {
      // Not a measurement line -- check if it's a text note or a player name
      const isNote = /[,.]/.test(cell) && !/^\d/.test(cell) && cell.length > 20;
      if (isNote && currentName) {
        currentWarnings.push(`note: ${cell}`);
      } else {
        // New player name -- flush previous
        if (currentName) flushPlayer();
        currentName = cell.replace(/:$/, "").replace(/-$/, "").trim();
      }
    }
  }

  // Flush last player at EOF
  flushPlayer();

  return results;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run scripts/__tests__/import-utils.test.ts -t "parseVerticalCard"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/import-utils.ts scripts/__tests__/import-utils.test.ts
git commit -m "feat(import): add parseVerticalCard parser"
```

### Task 7: Add `parseVerticalLabeled` parser

**Files:**

- Modify: `scripts/import-utils.ts`
- Modify: `scripts/__tests__/import-utils.test.ts`

- [ ] **Step 1: Write test for `parseVerticalLabeled`**

```typescript
describe("parseVerticalLabeled", () => {
  it("parses Kawkab-style vertical blocks", () => {
    const content = [
      ",,,,,,,,,,אדהם,חודש נובמבר",
      ",,,,,,,,,,5 מטר: 1.03,",
      ",,,,,,,,,,10 מטר: 1.88,",
      ",,,,,,,,,,קפיצה שתי רגליים: 2.17,",
      ",,,,,,,,,,רגל ימין: 1.90,",
      ",,,,,,,,,,רגל שמאל: 2.05,",
      ",,,,,,,,,,זריזות: 5.36,",
      ",,,,,,,,,,,",
      ",,,,,,,,,,אדם,",
      ",,,,,,,,,,5 מטר: 1.09,",
      ",,,,,,,,,,10 מטר: 1.98,",
    ].join("\n");
    const result = parseVerticalLabeled(content, "kawkab.csv", "2024-11-01");
    expect(result).toHaveLength(2);
    expect(result[0].csv_name).toBe("אדהם");
    expect(result[0].sprint_5m).toBe(1.03);
    expect(result[0].sprint_10m).toBe(1.88);
    expect(result[0].jump_2leg_distance).toBe(217); // normalized to cm
    expect(result[0].jump_right_leg).toBe(190);
    expect(result[0].jump_left_leg).toBe(205);
    expect(result[1].csv_name).toBe("אדם");
    expect(result[1].sprint_5m).toBe(1.09);
  });

  it("drops זריזות field", () => {
    const content = [
      ",,,,,,,,,,player,",
      ",,,,,,,,,,זריזות: 5.36,",
    ].join("\n");
    const result = parseVerticalLabeled(content, "test.csv", "2024-11-01");
    // No field maps to diagonal agility -- should have no sprint/jump data
    expect(result[0].sprint_5m).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/__tests__/import-utils.test.ts -t "parseVerticalLabeled"`
Expected: FAIL

- [ ] **Step 3: Implement `parseVerticalLabeled`**

```typescript
export function parseVerticalLabeled(
  content: string,
  sourceFile: string,
  assessmentDate: string
): NormalizedAssessmentRow[] {
  const lines = content.split("\n");
  const results: NormalizedAssessmentRow[] = [];

  let currentName: string | null = null;
  let currentData: Partial<NormalizedAssessmentRow> = {};

  function flushPlayer() {
    if (currentName) {
      results.push({
        source_file: sourceFile,
        csv_name: currentName,
        assessment_date: assessmentDate,
        sprint_5m: currentData.sprint_5m ?? null,
        sprint_10m: currentData.sprint_10m ?? null,
        sprint_20m: null,
        jump_2leg_distance: currentData.jump_2leg_distance ?? null,
        jump_right_leg: currentData.jump_right_leg ?? null,
        jump_left_leg: currentData.jump_left_leg ?? null,
        jump_2leg_height: null,
        kick_power_kaiser: null,
        blaze_spot_time: null,
        coordination: null,
        warnings: [],
      });
    }
    currentName = null;
    currentData = {};
  }

  for (const rawLine of lines) {
    const fields = parseCSVLine(rawLine);
    const cell = (fields[10] || "").trim(); // data in column 10
    if (!cell) continue;

    // Check if it's a "label: value" measurement line
    const labelMatch = cell.match(/^(.+?):\s*([\d.]+)$/);
    if (labelMatch) {
      const label = labelMatch[1].trim();
      const value = parseFloat(labelMatch[2]);
      if (isNaN(value)) continue;

      if (/^5 מטר$/.test(label)) currentData.sprint_5m = value;
      else if (/^10 מטר$/.test(label)) currentData.sprint_10m = value;
      else if (/קפיצה שתי רגליים/.test(label)) currentData.jump_2leg_distance = normalizeToCm(value);
      else if (/רגל ימין/.test(label)) currentData.jump_right_leg = normalizeToCm(value);
      else if (/רגל שמאל/.test(label)) currentData.jump_left_leg = normalizeToCm(value);
      // "זריזות" is dropped per spec
    } else {
      // Not a measurement -- it's a player name
      if (currentName) flushPlayer();
      currentName = cell;
    }
  }

  // Flush last player
  flushPlayer();

  return results;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run scripts/__tests__/import-utils.test.ts -t "parseVerticalLabeled"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/import-utils.ts scripts/__tests__/import-utils.test.ts
git commit -m "feat(import): add parseVerticalLabeled parser"
```

---

## Chunk 3: Phase 1 and Phase 2 Scripts

### Task 8: Build Phase 1 extract script (`scripts/extract-assessments.ts`)

**Files:**

- Create: `scripts/extract-assessments.ts`

- [ ] **Step 1: Create extract script with file registry and main orchestration**

```typescript
/**
 * Phase 1: Extract all assessment CSVs into a single mapping.csv for review.
 *
 * Usage:
 *   npx tsx scripts/extract-assessments.ts [--output path/to/mapping.csv]
 *
 * Default output: assesments-to-import/mapping.csv
 */

import * as fs from "fs";
import * as path from "path";
import {
  loadEnvLocal,
  getAdminClient,
  parseStandardColumnar,
  parseReorderedColumnar,
  parseVerticalCard,
  parseVerticalLabeled,
  findProfileMatch,
  type NormalizedAssessmentRow,
  type ProfileMatch,
} from "./import-utils";

loadEnvLocal();

// ---------------------------------------------------------------------------
// File registry: maps each CSV file to its parser, date, and line ranges
// ---------------------------------------------------------------------------

interface FileConfig {
  filename: string;
  parser: "standard" | "reordered" | "verticalCard" | "verticalLabeled";
  date: string;
  lineRange?: { start: number; end: number }; // 1-indexed, inclusive
}

const FILE_CONFIGS: FileConfig[] = [
  { filename: "מבדקים כדורגלנים - יולי.csv", parser: "standard", date: "2024-07-01" },
  { filename: "מבדקים כדורגלנים - אוגוסט.csv", parser: "standard", date: "2024-08-01" },
  { filename: "מבדקים כדורגלנים - אוקטובר.csv", parser: "standard", date: "2024-10-01" },
  { filename: "מבדקים כדורגלנים - מרץ - אפריל- .csv", parser: "standard", date: "2024-03-01" },
  { filename: "מבדקים כדורגלנים - ינואר25 (1).csv", parser: "standard", date: "2025-01-01" },
  { filename: "מבדקים כדורגלנים - נובמבר.csv", parser: "reordered", date: "2024-11-01", lineRange: { start: 1, end: 95 } },
  { filename: "מבדקים כדורגלנים - נובמבר.csv", parser: "reordered", date: "2024-11-01", lineRange: { start: 271, end: 275 } },
  { filename: "מבדקים כדורגלנים - נובמבר.csv", parser: "verticalCard", date: "2024-11-01", lineRange: { start: 281, end: 520 } },
  { filename: "מבדקים כדורגלנים - מבדקים כאוכב נובמבר.csv", parser: "verticalLabeled", date: "2024-11-01" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readFileSection(filePath: string, lineRange?: { start: number; end: number }): string {
  const content = fs.readFileSync(filePath, "utf-8");
  if (!lineRange) return content;
  const lines = content.split("\n");
  return lines.slice(lineRange.start - 1, lineRange.end).join("\n");
}

function parseSection(config: FileConfig, content: string): NormalizedAssessmentRow[] {
  const label = config.lineRange
    ? `${config.filename}:${config.lineRange.start}-${config.lineRange.end}`
    : config.filename;

  switch (config.parser) {
    case "standard": return parseStandardColumnar(content, label, config.date);
    case "reordered": return parseReorderedColumnar(content, label, config.date);
    case "verticalCard": return parseVerticalCard(content, label, config.date);
    case "verticalLabeled": return parseVerticalLabeled(content, label, config.date);
  }
}

// ---------------------------------------------------------------------------
// CSV Output
// ---------------------------------------------------------------------------

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function writeMappingCSV(
  outputPath: string,
  rows: Array<NormalizedAssessmentRow & {
    matched_profile_name: string;
    profile_id: string;
    match_confidence: string;
  }>
): void {
  const header = [
    "source_file", "csv_name", "matched_profile_name", "profile_id",
    "assessment_date", "match_confidence",
    "sprint_5m", "sprint_10m", "sprint_20m",
    "jump_2leg_distance", "jump_right_leg", "jump_left_leg",
    "jump_2leg_height", "kick_power_kaiser", "blaze_spot_time",
    "coordination", "warnings",
  ].join(",");

  const lines = rows.map((r) => [
    escapeCSV(r.source_file),
    escapeCSV(r.csv_name),
    escapeCSV(r.matched_profile_name),
    r.profile_id,
    r.assessment_date,
    r.match_confidence,
    r.sprint_5m ?? "",
    r.sprint_10m ?? "",
    r.sprint_20m ?? "",
    r.jump_2leg_distance ?? "",
    r.jump_right_leg ?? "",
    r.jump_left_leg ?? "",
    r.jump_2leg_height ?? "",
    r.kick_power_kaiser ?? "",
    r.blaze_spot_time ?? "",
    r.coordination ?? "",
    escapeCSV(r.warnings.join("; ")),
  ].join(","));

  // BOM for Hebrew in Excel
  const bom = "\uFEFF";
  fs.writeFileSync(outputPath, bom + header + "\n" + lines.join("\n") + "\n", "utf-8");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const outputFlag = process.argv.find((a) => a.startsWith("--output="));
  const outputPath = outputFlag
    ? outputFlag.split("=")[1]
    : args[0] || path.join("assesments-to-import", "mapping.csv");

  const baseDir = path.join(process.cwd(), "assesments-to-import");

  // Parse all sections
  console.log("Parsing CSV files...");
  const allRows: NormalizedAssessmentRow[] = [];

  for (const config of FILE_CONFIGS) {
    const filePath = path.join(baseDir, config.filename);
    if (!fs.existsSync(filePath)) {
      console.error(`  SKIP: ${config.filename} (not found)`);
      continue;
    }
    const content = readFileSection(filePath, config.lineRange);
    const rows = parseSection(config, content);
    const rangeLabel = config.lineRange ? ` [lines ${config.lineRange.start}-${config.lineRange.end}]` : "";
    console.log(`  ${config.filename}${rangeLabel}: ${rows.length} players`);
    allRows.push(...rows);
  }

  console.log(`\nTotal parsed rows: ${allRows.length}`);

  // Load profiles for matching
  const supabase = getAdminClient();
  console.log("Loading profiles from Supabase...");
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "trainee")
    .order("full_name");

  if (error) {
    console.error("Failed to load profiles:", error);
    process.exit(1);
  }
  console.log(`Loaded ${profiles.length} trainee profiles`);

  // Match names
  const mappedRows = allRows.map((row) => {
    const { profile, confidence } = findProfileMatch(row.csv_name, profiles as ProfileMatch[]);
    return {
      ...row,
      matched_profile_name: profile?.full_name || "",
      profile_id: profile?.id || "",
      match_confidence: confidence,
    };
  });

  // Write mapping CSV
  writeMappingCSV(path.resolve(process.cwd(), outputPath), mappedRows);
  console.log(`\nMapping written to: ${outputPath}`);

  // Summary
  const matched = mappedRows.filter((r) => r.match_confidence !== "none");
  const unmatched = mappedRows.filter((r) => r.match_confidence === "none");
  const withWarnings = mappedRows.filter((r) => r.warnings.length > 0);
  console.log(`  Matched: ${matched.length} (exact: ${matched.filter((r) => r.match_confidence === "exact").length}, partial: ${matched.filter((r) => r.match_confidence === "partial").length}, token: ${matched.filter((r) => r.match_confidence === "token").length})`);
  console.log(`  Unmatched: ${unmatched.length}`);
  console.log(`  With warnings: ${withWarnings.length}`);

  if (unmatched.length > 0) {
    console.log("\nUnmatched names:");
    for (const r of unmatched) {
      console.log(`  ${r.csv_name} (${r.source_file})`);
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Test extract script with dry output**

Run: `npx tsx scripts/extract-assessments.ts`
Expected: Outputs `assesments-to-import/mapping.csv` with all parsed rows, match report printed to console.

- [ ] **Step 3: Commit**

```bash
git add scripts/extract-assessments.ts
git commit -m "feat(import): add Phase 1 extract-assessments script"
```

### Task 9: Build Phase 2 import script (`scripts/import-from-mapping.ts`)

**Files:**

- Create: `scripts/import-from-mapping.ts`

- [ ] **Step 1: Create import-from-mapping script**

```typescript
/**
 * Phase 2: Import reviewed mapping.csv into player_assessments.
 *
 * Usage:
 *   npx tsx scripts/import-from-mapping.ts <mapping.csv> [--dry-run]
 */

import * as fs from "fs";
import * as path from "path";
import { loadEnvLocal, getAdminClient, parseCSVLine } from "./import-utils";

loadEnvLocal();

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const DRY_RUN = process.argv.includes("--dry-run");

if (args.length < 1) {
  console.error("Usage: npx tsx scripts/import-from-mapping.ts <mapping.csv> [--dry-run]");
  process.exit(1);
}

const MAPPING_PATH = path.resolve(process.cwd(), args[0]);

interface MappingRow {
  source_file: string;
  csv_name: string;
  matched_profile_name: string;
  profile_id: string;
  assessment_date: string;
  match_confidence: string;
  sprint_5m: number | null;
  sprint_10m: number | null;
  sprint_20m: number | null;
  jump_2leg_distance: number | null;
  jump_right_leg: number | null;
  jump_left_leg: number | null;
  jump_2leg_height: number | null;
  kick_power_kaiser: number | null;
  blaze_spot_time: number | null;
  coordination: string | null;
  warnings: string;
}

function parseNum(val: string): number | null {
  if (!val || val.trim() === "") return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function readMapping(filePath: string): MappingRow[] {
  let content = fs.readFileSync(filePath, "utf-8");
  // Strip BOM
  if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);

  const lines = content.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  // Skip header
  return lines.slice(1).map((line) => {
    const f = parseCSVLine(line);
    return {
      source_file: f[0] || "",
      csv_name: f[1] || "",
      matched_profile_name: f[2] || "",
      profile_id: f[3] || "",
      assessment_date: f[4] || "",
      match_confidence: f[5] || "",
      sprint_5m: parseNum(f[6] || ""),
      sprint_10m: parseNum(f[7] || ""),
      sprint_20m: parseNum(f[8] || ""),
      jump_2leg_distance: parseNum(f[9] || ""),
      jump_right_leg: parseNum(f[10] || ""),
      jump_left_leg: parseNum(f[11] || ""),
      jump_2leg_height: parseNum(f[12] || ""),
      kick_power_kaiser: parseNum(f[13] || ""),
      blaze_spot_time: parseNum(f[14] || ""),
      coordination: f[15]?.trim() || null,
      warnings: f[16] || "",
    };
  });
}

async function main() {
  console.log(`\nReading mapping: ${MAPPING_PATH}`);
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);

  if (!fs.existsSync(MAPPING_PATH)) {
    console.error(`File not found: ${MAPPING_PATH}`);
    process.exit(1);
  }

  const rows = readMapping(MAPPING_PATH);
  console.log(`Total rows: ${rows.length}`);

  // Filter rows with profile_id
  const importable = rows.filter((r) => r.profile_id.trim().length > 0);
  const skipped = rows.filter((r) => r.profile_id.trim().length === 0);
  console.log(`Importable: ${importable.length}, Skipped (no profile_id): ${skipped.length}`);

  if (importable.length === 0) {
    console.log("Nothing to import.");
    return;
  }

  const supabase = getAdminClient();
  let inserted = 0;
  let alreadyExists = 0;
  let errors = 0;

  for (const row of importable) {
    // Check for data
    const hasData = [
      row.sprint_5m, row.sprint_10m, row.jump_2leg_distance,
      row.jump_right_leg, row.jump_left_leg, row.jump_2leg_height,
      row.kick_power_kaiser, row.blaze_spot_time, row.coordination,
    ].some((v) => v !== null && v !== "");

    if (!hasData) {
      console.log(`  SKIP (no data): ${row.csv_name}`);
      continue;
    }

    if (!DRY_RUN) {
      // Idempotency check: filter deleted_at IS NULL
      const { data: existing } = await supabase
        .from("player_assessments")
        .select("id")
        .eq("user_id", row.profile_id)
        .eq("assessment_date", row.assessment_date)
        .is("deleted_at", null);

      if (existing && existing.length > 0) {
        console.log(`  EXISTS: ${row.csv_name} (${row.assessment_date})`);
        alreadyExists++;
        continue;
      }

      const { error } = await supabase
        .from("player_assessments")
        .insert({
          user_id: row.profile_id,
          assessment_date: row.assessment_date,
          sprint_5m: row.sprint_5m,
          sprint_10m: row.sprint_10m,
          sprint_20m: row.sprint_20m,
          jump_2leg_distance: row.jump_2leg_distance,
          jump_right_leg: row.jump_right_leg,
          jump_left_leg: row.jump_left_leg,
          jump_2leg_height: row.jump_2leg_height,
          kick_power_kaiser: row.kick_power_kaiser,
          blaze_spot_time: row.blaze_spot_time,
          coordination: row.coordination,
        });

      if (error) {
        console.error(`  ERROR: ${row.csv_name}: ${error.message}`);
        errors++;
      } else {
        console.log(`  OK: ${row.csv_name} (${row.assessment_date})`);
        inserted++;
      }
    } else {
      console.log(`  DRY: ${row.csv_name} -> ${row.matched_profile_name} (${row.assessment_date})`);
      inserted++;
    }
  }

  console.log("\n--- IMPORT SUMMARY ---");
  console.log(`  ${DRY_RUN ? "Would insert" : "Inserted"}: ${inserted}`);
  console.log(`  Already existed: ${alreadyExists}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Skipped (no profile_id): ${skipped.length}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Commit**

```bash
git add scripts/import-from-mapping.ts
git commit -m "feat(import): add Phase 2 import-from-mapping script"
```

### Task 10: Run full pipeline end-to-end

- [ ] **Step 1: Run Phase 1 extract**

Run: `npx tsx scripts/extract-assessments.ts`
Expected: Creates `assesments-to-import/mapping.csv`, prints summary with match stats.

- [ ] **Step 2: Verify mapping.csv looks correct**

Open `assesments-to-import/mapping.csv` in a text editor or spreadsheet. Check:

- Rows have correct source files and dates
- Numeric values are in expected ranges (sprints 0.8-3.0s, jumps 100-300cm)
- Kaiser values and jump heights are properly split
- Match confidence column shows exact/partial/token/none distribution

- [ ] **Step 3: Run Phase 2 dry run**

Run: `npx tsx scripts/import-from-mapping.ts assesments-to-import/mapping.csv --dry-run`
Expected: Lists all importable rows, no errors.

- [ ] **Step 4: Run all tests**

Run: `npx vitest run scripts/__tests__/import-utils.test.ts`
Expected: All tests pass.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(import): complete assessment CSV bulk import pipeline"
```

---

## Execution Notes

- **After Task 10 Step 2**: The human must review `mapping.csv` before running the live import. Fill in missing `profile_id` values, verify `token` matches, delete unwanted rows.
- **Live import**: Only after human approval, run `npx tsx scripts/import-from-mapping.ts assesments-to-import/mapping.csv` (without `--dry-run`).
- **Rollback**: If something goes wrong, assessments can be soft-deleted via `deleted_at` column.
- **Cleanup**: After successful import, the `assesments-to-import/` directory and scripts can be removed or gitignored.
