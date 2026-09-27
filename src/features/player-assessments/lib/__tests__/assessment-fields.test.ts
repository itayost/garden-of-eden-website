import { describe, expect, test } from "vitest";

import { assessmentInsertFields, assessmentUpdateFields } from "../assessment-fields";

describe("assessmentUpdateFields", () => {
  test("keeps the measured fields", () => {
    expect(assessmentUpdateFields({ sprint_10m: 2.1, notes: "טוב" })).toEqual({ sprint_10m: 2.1, notes: "טוב" });
  });

  test("drops ownership, identity, audit and delete fields", () => {
    // An edit must not move an assessment to another trainee or un-delete it.
    const patch = {
      sprint_10m: 2.1,
      user_id: "someone-else",
      id: "x",
      assessed_by: "y",
      created_at: "2020-01-01",
      deleted_at: null,
      deleted_by: null,
    };

    expect(assessmentUpdateFields(patch)).toEqual({ sprint_10m: 2.1 });
  });
});

describe("assessmentInsertFields", () => {
  test("keeps the trainee but drops identity, audit and delete fields", () => {
    const input = { user_id: "trainee", assessment_date: "2026-09-27", id: "x", assessed_by: "y", deleted_at: "z" };

    expect(assessmentInsertFields(input)).toEqual({ user_id: "trainee", assessment_date: "2026-09-27" });
  });
});
