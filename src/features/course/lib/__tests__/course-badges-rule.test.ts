import { describe, expect, test } from "vitest";

import { courseEarnsBadges } from "../course-slugs";

describe("courseEarnsBadges", () => {
  test("the digital course earns the course badges", () => {
    expect(courseEarnsBadges("eden-player-development")).toBe(true);
  });

  test("the tactical course does not, until it has badges of its own", () => {
    // course_complete reads "צפית בכל השיעורים בקורס הדיגיטלי".
    expect(courseEarnsBadges("tactical")).toBe(false);
  });
});
