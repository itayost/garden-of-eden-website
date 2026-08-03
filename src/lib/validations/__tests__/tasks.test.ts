import { describe, expect, test } from "vitest";

import {
  dailyBriefSchema,
  taskCompleteSchema,
  taskCreateSchema,
  taskUpdateSchema,
} from "@/lib/validations/tasks";

const TRAINER_A = "11111111-1111-4111-8111-111111111111";
const TRAINER_B = "22222222-2222-4222-8222-222222222222";
const TRAINEE = "33333333-3333-4333-8333-333333333333";
const TASK = "44444444-4444-4444-8444-444444444444";

function validCreate(overrides: Record<string, unknown> = {}) {
  return {
    title: "לתקן את הרשת",
    description: "",
    trainerIds: [TRAINER_A],
    traineeId: null,
    dueDate: "2026-08-03",
    ...overrides,
  };
}

describe("taskCreateSchema", () => {
  test("accepts a minimal valid task", () => {
    const result = taskCreateSchema.safeParse(validCreate());

    expect(result.success).toBe(true);
  });

  test("trims the title and rejects a whitespace-only one", () => {
    expect(taskCreateSchema.parse(validCreate({ title: "  לנעול  " })).title).toBe(
      "לנעול",
    );
    expect(taskCreateSchema.safeParse(validCreate({ title: "   " })).success).toBe(
      false,
    );
  });

  test("turns an empty description into null so the DB stores NULL, not an empty string", () => {
    // The migration declares CHECK (title <> ''), and NULL vs "" is the
    // difference between a clean optional column and a constraint violation.
    expect(taskCreateSchema.parse(validCreate({ description: "" })).description).toBe(
      null,
    );
    expect(
      taskCreateSchema.parse(validCreate({ description: "   " })).description,
    ).toBe(null);
    expect(
      taskCreateSchema.parse(validCreate({ description: undefined })).description,
    ).toBe(null);
    expect(taskCreateSchema.parse(validCreate({ description: null })).description).toBe(
      null,
    );
  });

  test("keeps a real description", () => {
    expect(
      taskCreateSchema.parse(validCreate({ description: " יש חבק שבור " }))
        .description,
    ).toBe("יש חבק שבור");
  });

  test("requires at least one trainer", () => {
    expect(taskCreateSchema.safeParse(validCreate({ trainerIds: [] })).success).toBe(
      false,
    );
  });

  test("accepts several trainers for the fan-out", () => {
    const result = taskCreateSchema.parse(
      validCreate({ trainerIds: [TRAINER_A, TRAINER_B] }),
    );

    expect(result.trainerIds).toEqual([TRAINER_A, TRAINER_B]);
  });

  test("rejects a non-UUID trainer id", () => {
    expect(
      taskCreateSchema.safeParse(validCreate({ trainerIds: ["not-a-uuid"] })).success,
    ).toBe(false);
  });

  test("normalises a missing trainee to null", () => {
    expect(taskCreateSchema.parse(validCreate({ traineeId: undefined })).traineeId).toBe(
      null,
    );
    expect(taskCreateSchema.parse(validCreate({ traineeId: TRAINEE })).traineeId).toBe(
      TRAINEE,
    );
  });

  test("rejects a malformed or impossible due date", () => {
    expect(taskCreateSchema.safeParse(validCreate({ dueDate: "03/08/2026" })).success).toBe(
      false,
    );
    expect(taskCreateSchema.safeParse(validCreate({ dueDate: "2026-02-30" })).success).toBe(
      false,
    );
    expect(taskCreateSchema.safeParse(validCreate({ dueDate: "" })).success).toBe(false);
  });

  test("rejects a title beyond the length cap", () => {
    expect(
      taskCreateSchema.safeParse(validCreate({ title: "א".repeat(201) })).success,
    ).toBe(false);
  });
});

describe("taskUpdateSchema", () => {
  test("accepts a valid edit", () => {
    const result = taskUpdateSchema.safeParse({
      taskId: TASK,
      title: "לתקן את הרשת",
      description: "",
      assignedTo: TRAINER_A,
      traineeId: null,
      dueDate: "2026-08-03",
    });

    expect(result.success).toBe(true);
  });

  test("requires a single assignee, not a list", () => {
    const result = taskUpdateSchema.safeParse({
      taskId: TASK,
      title: "לתקן",
      assignedTo: [TRAINER_A],
      dueDate: "2026-08-03",
    });

    expect(result.success).toBe(false);
  });
});

describe("taskCompleteSchema", () => {
  test("makes the completion note optional and nulls an empty one", () => {
    expect(
      taskCompleteSchema.parse({ taskId: TASK, completionNote: "" }).completionNote,
    ).toBe(null);
    expect(taskCompleteSchema.parse({ taskId: TASK }).completionNote).toBe(null);
    expect(
      taskCompleteSchema.parse({ taskId: TASK, completionNote: " תוקן " })
        .completionNote,
    ).toBe("תוקן");
  });

  test("rejects a bad task id", () => {
    expect(taskCompleteSchema.safeParse({ taskId: "nope" }).success).toBe(false);
  });
});

describe("dailyBriefSchema", () => {
  test("requires non-empty content", () => {
    // content is NOT NULL CHECK (content <> '') in the DB, so an empty brief
    // must fail here rather than reaching Postgres.
    expect(
      dailyBriefSchema.safeParse({ briefDate: "2026-08-03", content: "" }).success,
    ).toBe(false);
    expect(
      dailyBriefSchema.safeParse({ briefDate: "2026-08-03", content: "   " }).success,
    ).toBe(false);
  });

  test("trims content", () => {
    expect(
      dailyBriefSchema.parse({ briefDate: "2026-08-03", content: "  צלם ב-16:00  " })
        .content,
    ).toBe("צלם ב-16:00");
  });

  test("rejects an invalid date", () => {
    expect(
      dailyBriefSchema.safeParse({ briefDate: "2026-13-01", content: "טקסט" }).success,
    ).toBe(false);
  });
});
