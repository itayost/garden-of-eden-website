import { describe, expect, test } from "vitest";

import { cmsVideoPath, MAX_LESSON_VIDEO_BYTES } from "../playback-config";

describe("cmsVideoPath", () => {
  test("is keyed by lesson id, so two courses never share a path", () => {
    // Chapter slugs are unique only within a course; a lesson id is unique everywhere.
    expect(cmsVideoPath("11111111-1111-4111-8111-111111111111")).toBe(
      "cms/11111111-1111-4111-8111-111111111111.mp4",
    );
  });
});

describe("MAX_LESSON_VIDEO_BYTES", () => {
  test("allows a two-gigabyte recording", () => {
    expect(MAX_LESSON_VIDEO_BYTES).toBe(2 * 1024 ** 3);
  });
});
