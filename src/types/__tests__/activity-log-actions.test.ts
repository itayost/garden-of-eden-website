import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { ACTIVITY_ACTION_LABELS_HE } from "../activity-log";

const ROOT = join(__dirname, "../../..");
const ADD_CHECK = "ADD CONSTRAINT activity_logs_action_check";

/** The actions allowed by the newest migration that (re)defines the check. */
function allowedByDatabase(): Set<string> {
  const dir = join(ROOT, "supabase/migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort().reverse()) {
    const sql = readFileSync(join(dir, file), "utf8");
    if (!sql.includes(ADD_CHECK)) continue;
    const definition = sql.slice(sql.lastIndexOf(ADD_CHECK));
    return new Set([...definition.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]));
  }
  throw new Error("no migration adds activity_logs_action_check");
}

/** Every `action: "..."` literal in a source file that writes activity_logs. */
function actionsWrittenByApp(): string[] {
  const src = join(ROOT, "src");
  return (readdirSync(src, { recursive: true }) as string[])
    .filter((f) => /\.tsx?$/.test(f) && !f.includes("__tests__"))
    .map((f) => readFileSync(join(src, f), "utf8"))
    .filter((code) => code.includes(`"activity_logs"`))
    .flatMap((code) => [...code.matchAll(/action: "([a-z_]+)"/g)].map((m) => m[1]));
}

describe("activity log actions", () => {
  // An action missing from the check is refused on insert, and most callers
  // only log that error, so the audit record is silently lost.
  it("allows every action the app writes or the history labels", () => {
    const allowed = allowedByDatabase();
    const used = new Set([...actionsWrittenByApp(), ...Object.keys(ACTIVITY_ACTION_LABELS_HE)]);
    expect([...used].filter((a) => !allowed.has(a))).toEqual([]);
  });
});
