import { describe, expect, test } from "vitest";

import { pickResumableUpload } from "../resume-upload";

const previous = (objectName: string) => ({ metadata: { objectName }, uploadUrl: `u-${objectName}` });

describe("pickResumableUpload", () => {
  test("resumes an earlier upload of this file to the same lesson", () => {
    const earlier = previous("cms/lesson-a.mp4");

    expect(pickResumableUpload([earlier], "cms/lesson-a.mp4")).toBe(earlier);
  });

  test("never resumes into another lesson's key", () => {
    // tus fingerprints the file, not the target: the same recording picked for
    // lesson B must not resume into lesson A's object.
    expect(pickResumableUpload([previous("cms/lesson-a.mp4")], "cms/lesson-b.mp4")).toBeUndefined();
  });

  test("ignores stored uploads with no metadata", () => {
    const stored: { uploadUrl: string; metadata?: Record<string, string> }[] = [{ uploadUrl: "x" }];

    expect(pickResumableUpload(stored, "cms/lesson-a.mp4")).toBeUndefined();
  });
});
