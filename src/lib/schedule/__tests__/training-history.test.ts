import { describe, expect, it } from "vitest";
import {
  groupGuestRows,
  guestNameKey,
  historyStatus,
  historySummary,
  toHistoryEntries,
  type HistoryRow,
} from "../training-history";

const NOW = { date: "2026-10-23", minutes: 17 * 60 };

const row = (overrides: Partial<HistoryRow>): HistoryRow => ({
  id: "r1",
  trainee_name: "יונתן כהן",
  schedule_date: "2026-10-20",
  start_time: "16:00:00",
  branch_id: "ka",
  location_he: null,
  trainer_names: [],
  cancelled_at: null,
  late_cancel: false,
  removed_at: null,
  called_off: false,
  ...overrides,
});

describe("historyStatus", () => {
  it("counts a past roster row as attended", () => {
    expect(historyStatus(row({}), NOW)).toBe("attended");
  });

  it("treats a slot that has not started yet as upcoming", () => {
    expect(historyStatus(row({ schedule_date: "2026-10-23", start_time: "18:00" }), NOW)).toBe("upcoming");
    expect(historyStatus(row({ schedule_date: "2026-10-30" }), NOW)).toBe("upcoming");
  });

  it("counts a slot that started today as attended", () => {
    expect(historyStatus(row({ schedule_date: "2026-10-23", start_time: "16:30" }), NOW)).toBe("attended");
  });

  it("tells a late cancel (a used session) from a free one", () => {
    expect(historyStatus(row({ cancelled_at: "x", late_cancel: true }), NOW)).toBe("late_cancel");
    expect(historyStatus(row({ cancelled_at: "x" }), NOW)).toBe("cancelled");
  });

  it("marks a recorded removal and a called off slot ahead of the rest", () => {
    expect(historyStatus(row({ cancelled_at: "x", removed_at: "x" }), NOW)).toBe("removed");
    expect(historyStatus(row({ called_off: true, cancelled_at: "x", late_cancel: true }), NOW)).toBe("called_off");
  });
});

describe("toHistoryEntries", () => {
  it("lists the newest training first, breaking a same-day tie by time", () => {
    const entries = toHistoryEntries(
      [
        row({ id: "a", schedule_date: "2026-10-01" }),
        row({ id: "b", schedule_date: "2026-10-20", start_time: "09:00" }),
        row({ id: "c", schedule_date: "2026-10-20", start_time: "17:00" }),
      ],
      NOW,
    );
    expect(entries.map((e) => e.id)).toEqual(["c", "b", "a"]);
  });
});

describe("historySummary", () => {
  it("counts each status, with late cancels inside the used sessions", () => {
    const entries = toHistoryEntries(
      [
        row({ id: "a" }),
        row({ id: "b" }),
        row({ id: "c", cancelled_at: "x", late_cancel: true }),
        row({ id: "d", cancelled_at: "x" }),
        row({ id: "e", schedule_date: "2026-11-01" }),
        row({ id: "f", called_off: true }),
      ],
      NOW,
    );
    expect(historySummary(entries)).toEqual({
      attended: 2,
      lateCancel: 1,
      cancelled: 1,
      upcoming: 1,
      calledOff: 1,
      removed: 0,
      used: 3,
      lastTrainingDate: "2026-10-20",
    });
  });

  it("has no last date when nothing took place", () => {
    expect(historySummary([]).lastTrainingDate).toBeNull();
  });
});

describe("guestNameKey", () => {
  it("ignores case, edge spaces and doubled spaces", () => {
    expect(guestNameKey("  Dan  Levi ")).toBe(guestNameKey("dan levi"));
  });
});

describe("groupGuestRows", () => {
  it("groups a typed name across slots and counts what took place", () => {
    const groups = groupGuestRows(
      [
        row({ id: "a", trainee_name: "אורח  אחד", schedule_date: "2026-10-01" }),
        row({ id: "b", trainee_name: "אורח אחד", schedule_date: "2026-10-15", branch_id: "haifa" }),
        row({ id: "c", trainee_name: "אורח אחד", cancelled_at: "x" }),
        row({ id: "d", trainee_name: "אורח אחד", schedule_date: "2026-11-02" }),
        row({ id: "e", trainee_name: "מישהו אחר" }),
      ],
      NOW,
    );
    expect(groups).toHaveLength(2);
    const [first] = groups;
    expect(first.name).toBe("אורח אחד");
    expect(first.used).toBe(2);
    expect(first.upcoming).toBe(1);
    expect(first.lastTrainingDate).toBe("2026-10-15");
    expect(first.branchIds).toEqual(["ka", "haifa"]);
    expect(first.entries.map((e) => e.id)).toEqual(["d", "c", "b", "a"]);
  });

  it("puts the most used name first", () => {
    const groups = groupGuestRows(
      [row({ id: "a", trainee_name: "ב" }), row({ id: "b", trainee_name: "א" }), row({ id: "c", trainee_name: "א" })],
      NOW,
    );
    expect(groups.map((g) => g.name)).toEqual(["א", "ב"]);
  });
});
