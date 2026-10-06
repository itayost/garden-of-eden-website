import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { ACTIVITY_ACTIONS } from "../activity-log";

const ROOT = join(__dirname, "../../..");
const CONSTRAINT = "activity_logs_action_check";

/** The actions the newest migration that (re)defines the check allows. */
function allowedByDatabase(): Set<string> {
  const dir = join(ROOT, "supabase/migrations");
  const latest = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(join(dir, f), "utf8"))
    .filter((sql) => sql.includes(`ADD CONSTRAINT ${CONSTRAINT}`))
    .at(-1);
  if (!latest) throw new Error(`no migration adds ${CONSTRAINT}`);
  const definition = latest.slice(latest.lastIndexOf(`ADD CONSTRAINT ${CONSTRAINT}`));
  return new Set([...definition.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]));
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "__tests__" ? [] : sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

/** Every `action: "..."` literal in a file that writes activity_logs. */
function actionsWrittenByApp(): Set<string> {
  return new Set(
    sourceFiles(join(ROOT, "src"))
      .map((f) => readFileSync(f, "utf8"))
      .filter((src) => src.includes(`"activity_logs"`))
      .flatMap((src) => [...src.matchAll(/action: "([a-z_]+)"/g)].map((m) => m[1])),
  );
}

describe("activity log actions", () => {
  // An action missing from the check is refused on insert, and most callers
  // only log that error, so the audit record is silently lost.
  it("allows every action the app writes", () => {
    const allowed = allowedByDatabase();
    const missing = [...actionsWrittenByApp()].filter((a) => !allowed.has(a));
    expect(missing).toEqual([]);
  });

  it("allows every action the activity history knows", () => {
    const allowed = allowedByDatabase();
    const missing = Object.values(ACTIVITY_ACTIONS).filter((a) => !allowed.has(a));
    expect(missing).toEqual([]);
  });
});
