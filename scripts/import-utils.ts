/**
 * Shared utilities for CSV assessment import scripts.
 *
 * Provides:
 * - .env.local loader
 * - Supabase admin client factory
 * - CSV line parser
 * - Numeric extraction and normalization helpers
 * - Kaiser/height column parser (% precedence)
 * - Single-leg jump parser
 * - Coordination mapper
 * - Blaze spot parser
 * - Name normalization and profile matching
 * - Normalized assessment row type
 * - Header/metadata row filter
 */

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

// ---------------------------------------------------------------------------
// CSV line parser
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Numeric extraction utilities
// ---------------------------------------------------------------------------
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

/** Normalize jump distance to cm. Values < 10 assumed to be in meters. */
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

// ---------------------------------------------------------------------------
// Kaiser / height column parser (% precedence)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Single-leg jump parser
// ---------------------------------------------------------------------------
export interface LegJumps {
  right: number | null;
  left: number | null;
}

export function parseSingleLegJump(value: string): LegJumps {
  if (!value || value === "??") return { right: null, left: null };
  const text = value.trim();

  // "ושמאל" means same value for both
  if (text.includes("ושמאל")) {
    const numbers = text.match(/[\d]+\.?[\d]*/g);
    if (numbers && numbers.length >= 1) {
      const lastNum = parseFloat(numbers[numbers.length - 1]);
      const cm = normalizeToCm(lastNum);
      return { right: cm, left: cm };
    }
    return { right: null, left: null };
  }

  // Find keyword positions
  const rightPositions: number[] = [];
  const leftPositions: number[] = [];
  const rightRegex = /ימי[ןנ]|ימן/g;
  const leftRegex = /שמאל/g;
  let match;
  while ((match = rightRegex.exec(text)) !== null) rightPositions.push(match.index);
  while ((match = leftRegex.exec(text)) !== null) leftPositions.push(match.index);

  const numberMatches = [...text.matchAll(/([\d]+\.?[\d]*)/g)].map((m) => ({
    value: parseFloat(m[1]),
    index: m.index!,
  }));

  if (numberMatches.length === 0) return { right: null, left: null };

  let rightVal: number | null = null;
  let leftVal: number | null = null;

  const hasRight = rightPositions.length > 0;
  const hasLeft = leftPositions.length > 0;

  if (hasRight && hasLeft && numberMatches.length >= 2) {
    const keywords = [
      ...rightPositions.map((p) => ({ pos: p, side: "right" as const })),
      ...leftPositions.map((p) => ({ pos: p, side: "left" as const })),
    ].sort((a, b) => a.pos - b.pos);

    const usedIndices = new Set<number>();
    for (const kw of keywords) {
      let bestNum: (typeof numberMatches)[0] | null = null;
      let bestDist = Infinity;
      for (const nm of numberMatches) {
        if (usedIndices.has(nm.index)) continue;
        const dist = Math.abs(nm.index - kw.pos);
        if (dist < bestDist) {
          bestDist = dist;
          bestNum = nm;
        }
      }
      if (bestNum) {
        if (kw.side === "right") rightVal = bestNum.value;
        else leftVal = bestNum.value;
        usedIndices.add(bestNum.index);
      }
    }
  } else if ((hasRight || hasLeft) && numberMatches.length >= 2) {
    const kwPos = hasRight ? rightPositions[0] : leftPositions[0];
    const before = numberMatches.filter((n) => n.index < kwPos);
    const after = numberMatches.filter((n) => n.index > kwPos);
    const thisLegNum = after.length > 0 ? after[0].value : null;
    const otherLegNum = before.length > 0 ? before[before.length - 1].value : null;
    if (hasRight) {
      rightVal = thisLegNum;
      leftVal = otherLegNum;
    } else {
      leftVal = thisLegNum;
      rightVal = otherLegNum;
    }
  } else if (numberMatches.length >= 2) {
    rightVal = numberMatches[0].value;
    leftVal = numberMatches[1].value;
  }

  return {
    right: rightVal !== null ? normalizeToCm(rightVal) : null,
    left: leftVal !== null ? normalizeToCm(leftVal) : null,
  };
}

// ---------------------------------------------------------------------------
// Coordination mapper
// ---------------------------------------------------------------------------
export function mapCoordination(value: string): "deficient" | "basic" | "advanced" | null {
  const num = parseInt(value, 10);
  if (isNaN(num) || num === 0) return null;
  if (num === 1) return "deficient";
  if (num <= 3) return "basic";
  if (num <= 5) return "advanced";
  return null;
}

// ---------------------------------------------------------------------------
// Blaze spot parser
// ---------------------------------------------------------------------------
export function parseBlazeSpot(value: string): number | null {
  if (!value) return null;
  const matches = value.match(/\d+/g);
  if (!matches) return null;
  return parseInt(matches[0], 10) || null;
}

// ---------------------------------------------------------------------------
// Name normalization and profile matching
// ---------------------------------------------------------------------------
export function normalizeName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, " ")
    .replace(/['"():\-.]/g, "")
    .replace(/\u200F/g, "")
    .replace(/\u200E/g, "")
    .toLowerCase();
}

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

// ---------------------------------------------------------------------------
// Normalized assessment row type
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Header / metadata row filter
// ---------------------------------------------------------------------------
export function isHeaderOrMetadata(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length === 0) return true;
  if (["שם השחקן", "שם", "שם שחקן", "כ", "אי"].includes(trimmed)) return true;
  if (trimmed.startsWith("עמודה") || trimmed.startsWith("תשאירו")) return true;
  return false;
}
