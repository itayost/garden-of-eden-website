import { describe, expect, test } from "vitest";
import { readSnooze, writeSnooze, type SnoozeStorage } from "../snooze-storage";
import { snoozeKey } from "../offer";

function memoryStorage(): SnoozeStorage & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

const failing: SnoozeStorage = {
  getItem: () => {
    throw new Error("storage blocked");
  },
  setItem: () => {
    throw new Error("quota exceeded");
  },
};

describe("snooze storage", () => {
  test("a written day reads back under the survey's own key", () => {
    const storage = memoryStorage();
    writeSnooze(storage, "s1", "2026-11-05");
    expect(storage.values.get(snoozeKey("s1"))).toBe("2026-11-05");
    expect(readSnooze(storage, "s1")).toBe("2026-11-05");
    expect(readSnooze(storage, "s2")).toBeNull();
  });

  test("a later write replaces the earlier day", () => {
    const storage = memoryStorage();
    writeSnooze(storage, "s1", "2026-11-05");
    writeSnooze(storage, "s1", "2026-11-06");
    expect(readSnooze(storage, "s1")).toBe("2026-11-06");
  });

  test("storage that throws reads as nothing stored and swallows the write", () => {
    expect(readSnooze(failing, "s1")).toBeNull();
    expect(() => writeSnooze(failing, "s1", "2026-11-05")).not.toThrow();
  });

  test("no storage at all reads as nothing stored and swallows the write", () => {
    expect(readSnooze(null, "s1")).toBeNull();
    expect(() => writeSnooze(null, "s1", "2026-11-05")).not.toThrow();
  });
});
