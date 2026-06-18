import { describe, it, expect } from "vitest";
import {
  mergeRetentionReports,
  type RetentionEntry,
  type RetentionReportData,
} from "../retention";

function entry(over: Partial<RetentionEntry>): RetentionEntry {
  return {
    user_id: null,
    name: "",
    phone: null,
    end_date: "2026-06-10",
    membership_type_name: "מתקדמים",
    attendance: [null, null, null, null],
    ...over,
  };
}

function report(over: Partial<RetentionReportData>): RetentionReportData {
  return { monthly: [], pro: [], training_card: [], ...over };
}

describe("mergeRetentionReports", () => {
  it("retains a stored entry that the fresh pull dropped (already ended)", () => {
    const stored = report({
      monthly: [entry({ user_id: 1, name: "Ended Early", end_date: "2026-06-05" })],
    });
    const fresh = report({
      monthly: [entry({ user_id: 2, name: "Still Active", end_date: "2026-06-25" })],
    });

    const merged = mergeRetentionReports(stored, fresh);

    expect(merged.monthly.map((e) => e.user_id)).toEqual([2, 1]);
  });

  it("adds fresh-only entries", () => {
    const merged = mergeRetentionReports(
      report({}),
      report({ pro: [entry({ user_id: 9, membership_type_name: "פרו" })] }),
    );
    expect(merged.pro).toHaveLength(1);
    expect(merged.pro[0].user_id).toBe(9);
  });

  it("fresh wins on collision (updated end_date and attendance)", () => {
    const stored = report({
      monthly: [entry({ user_id: 1, end_date: "2026-06-05", attendance: [1, 0, 0, 0] })],
    });
    const fresh = report({
      monthly: [entry({ user_id: 1, end_date: "2026-06-20", attendance: [4, 3, 2, 1] })],
    });

    const merged = mergeRetentionReports(stored, fresh);

    expect(merged.monthly).toHaveLength(1);
    expect(merged.monthly[0].end_date).toBe("2026-06-20");
    expect(merged.monthly[0].attendance).toEqual([4, 3, 2, 1]);
  });

  it("does not duplicate a member who moved category", () => {
    const stored = report({
      monthly: [entry({ user_id: 7, end_date: "2026-06-05" })],
    });
    const fresh = report({
      pro: [entry({ user_id: 7, end_date: "2026-06-22", membership_type_name: "פרו" })],
    });

    const merged = mergeRetentionReports(stored, fresh);

    expect(merged.monthly).toHaveLength(0);
    expect(merged.pro).toHaveLength(1);
    expect(merged.pro[0].user_id).toBe(7);
  });

  it("keeps a renewer (in stored, absent from fresh)", () => {
    const stored = report({
      monthly: [entry({ user_id: 3, name: "Renewed To July", end_date: "2026-06-17" })],
    });
    const fresh = report({ monthly: [] });

    const merged = mergeRetentionReports(stored, fresh);

    expect(merged.monthly).toHaveLength(1);
    expect(merged.monthly[0].user_id).toBe(3);
  });

  it("sorts each category by end_date descending", () => {
    const fresh = report({
      monthly: [
        entry({ user_id: 1, end_date: "2026-06-05" }),
        entry({ user_id: 2, end_date: "2026-06-28" }),
        entry({ user_id: 3, end_date: "2026-06-15" }),
      ],
    });

    const merged = mergeRetentionReports(report({}), fresh);

    expect(merged.monthly.map((e) => e.end_date)).toEqual([
      "2026-06-28",
      "2026-06-15",
      "2026-06-05",
    ]);
  });

  it("matches identity by phone when user_id is missing", () => {
    const stored = report({
      monthly: [entry({ user_id: null, phone: "0501234567", end_date: "2026-06-05" })],
    });
    const fresh = report({
      monthly: [entry({ user_id: null, phone: "+972501234567", end_date: "2026-06-20" })],
    });

    const merged = mergeRetentionReports(stored, fresh);

    // Same person via normalized phone -> single, fresh entry.
    expect(merged.monthly).toHaveLength(1);
    expect(merged.monthly[0].end_date).toBe("2026-06-20");
  });

  it("dedups by name+end_date when no user_id or phone (true repeat)", () => {
    const stored = report({
      monthly: [entry({ name: "דני כהן", end_date: "2026-06-21", attendance: [1, 0, 0, 0] })],
    });
    const fresh = report({
      monthly: [entry({ name: "דני כהן", end_date: "2026-06-21", attendance: [5, 0, 0, 0] })],
    });

    const merged = mergeRetentionReports(stored, fresh);

    expect(merged.monthly).toHaveLength(1);
    expect(merged.monthly[0].attendance).toEqual([5, 0, 0, 0]);
  });

  it("keeps two id/phone-less members who share a name but ended on different dates", () => {
    const stored = report({
      monthly: [entry({ name: "דני כהן", end_date: "2026-06-05" })],
    });
    const fresh = report({
      monthly: [entry({ name: "דני כהן", end_date: "2026-06-21" })],
    });

    const merged = mergeRetentionReports(stored, fresh);

    // Different people (no shared id/phone, different end_date) must not collapse.
    expect(merged.monthly).toHaveLength(2);
    expect(merged.monthly.map((e) => e.end_date)).toEqual([
      "2026-06-21",
      "2026-06-05",
    ]);
  });

  it("does not throw when a stored snapshot is missing a category key", () => {
    // Older/hand-edited rows may lack a category; merge must degrade, not crash.
    const malformedStored = {
      monthly: [entry({ user_id: 1, end_date: "2026-06-04" })],
    } as unknown as RetentionReportData;
    const fresh = report({
      training_card: [entry({ user_id: 2, end_date: "2026-06-25", membership_type_name: "כרטיסייה" })],
    });

    const merged = mergeRetentionReports(malformedStored, fresh);

    expect(merged.monthly.map((e) => e.user_id)).toEqual([1]);
    expect(merged.training_card.map((e) => e.user_id)).toEqual([2]);
    expect(merged.pro).toEqual([]);
  });
});
