import { describe, expect, test } from "vitest";

import {
  formatDueDate,
  isAwaitingReview,
  isTaskOverdue,
  israelToday,
} from "@/lib/utils/tasks";
import type { TrainerTask } from "@/types/tasks";

function task(overrides: Partial<TrainerTask> = {}): TrainerTask {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    title: "לתקן את הרשת",
    description: null,
    assigned_to: "00000000-0000-0000-0000-000000000002",
    trainee_id: null,
    due_date: "2026-08-03",
    status: "open",
    created_by: "00000000-0000-0000-0000-000000000003",
    created_by_name: "עדן",
    completion_note: null,
    completed_at: null,
    completed_by: null,
    reopen_reason: null,
    admin_seen_at: null,
    cancelled_at: null,
    created_at: "2026-08-01T09:00:00.000Z",
    updated_at: "2026-08-01T09:00:00.000Z",
    ...overrides,
  };
}

describe("israelToday", () => {
  test("returns the Israel calendar date, not the UTC date, late in the evening", () => {
    // 2026-08-03 20:30 UTC is 2026-08-03 23:30 in Israel (UTC+3, DST).
    const result = israelToday(new Date("2026-08-03T20:30:00.000Z"));

    expect(result).toBe("2026-08-03");
  });

  test("returns the next Israel day when UTC is still on the previous day", () => {
    // 2026-08-03 21:30 UTC is 2026-08-04 00:30 in Israel — the day has rolled.
    const result = israelToday(new Date("2026-08-03T21:30:00.000Z"));

    expect(result).toBe("2026-08-04");
  });

  test("handles winter time, when Israel is UTC+2", () => {
    // 2026-01-15 22:30 UTC is 2026-01-16 00:30 in Israel.
    const result = israelToday(new Date("2026-01-15T22:30:00.000Z"));

    expect(result).toBe("2026-01-16");
  });
});

describe("formatDueDate", () => {
  test("renders the stored date verbatim, independent of the viewer timezone", () => {
    // formatDateShort would parse this as UTC midnight and shift it back a day
    // on any UTC-negative device, disagreeing with isTaskOverdue.
    expect(formatDueDate("2026-08-03")).toBe("03/08/2026");
    expect(formatDueDate("2026-01-01")).toBe("01/01/2026");
    expect(formatDueDate("2025-12-31")).toBe("31/12/2025");
  });
});

describe("isTaskOverdue", () => {
  test("an open task due yesterday is overdue", () => {
    const result = isTaskOverdue(task({ due_date: "2026-08-02" }), "2026-08-03");

    expect(result).toBe(true);
  });

  test("an open task due today is not overdue", () => {
    const result = isTaskOverdue(task({ due_date: "2026-08-03" }), "2026-08-03");

    expect(result).toBe(false);
  });

  test("an open task due tomorrow is not overdue", () => {
    const result = isTaskOverdue(task({ due_date: "2026-08-04" }), "2026-08-03");

    expect(result).toBe(false);
  });

  test("a done task past its due date is not overdue", () => {
    const result = isTaskOverdue(
      task({ due_date: "2026-07-01", status: "done" }),
      "2026-08-03",
    );

    expect(result).toBe(false);
  });

  test("a cancelled task past its due date is not overdue", () => {
    const result = isTaskOverdue(
      task({ due_date: "2026-07-01", status: "cancelled" }),
      "2026-08-03",
    );

    expect(result).toBe(false);
  });

  test("compares across month and year boundaries", () => {
    expect(isTaskOverdue(task({ due_date: "2025-12-31" }), "2026-01-01")).toBe(true);
    expect(isTaskOverdue(task({ due_date: "2026-01-01" }), "2025-12-31")).toBe(false);
  });
});

describe("isAwaitingReview", () => {
  test("a done task the admin has not acknowledged is awaiting review", () => {
    const result = isAwaitingReview(task({ status: "done", admin_seen_at: null }));

    expect(result).toBe(true);
  });

  test("a done task the admin acknowledged is not awaiting review", () => {
    const result = isAwaitingReview(
      task({ status: "done", admin_seen_at: "2026-08-03T10:00:00.000Z" }),
    );

    expect(result).toBe(false);
  });

  test("an open task is never awaiting review", () => {
    const result = isAwaitingReview(task({ status: "open", admin_seen_at: null }));

    expect(result).toBe(false);
  });

  test("a cancelled task is never awaiting review", () => {
    const result = isAwaitingReview(task({ status: "cancelled", admin_seen_at: null }));

    expect(result).toBe(false);
  });
});
