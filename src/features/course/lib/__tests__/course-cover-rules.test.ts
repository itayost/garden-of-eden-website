import { describe, expect, it } from "vitest";
import {
  coverFileProblem,
  coverPrefix,
  coverStoragePath,
  isAllowedCoverUrl,
  MAX_COVER_BYTES,
} from "../course-cover-rules";

const BASE = "https://abc.supabase.co";
const COURSE = "11111111-1111-4111-8111-111111111111";

describe("coverFileProblem", () => {
  it("accepts jpeg, png and webp within the limit", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      expect(coverFileProblem({ type, size: 1000 })).toBeNull();
    }
  });
  it("refuses other types", () => {
    expect(coverFileProblem({ type: "image/gif", size: 1000 })).not.toBeNull();
    expect(coverFileProblem({ type: "image/svg+xml", size: 1000 })).not.toBeNull();
  });
  it("refuses an empty file and one over 5 MB", () => {
    expect(coverFileProblem({ type: "image/png", size: 0 })).not.toBeNull();
    expect(
      coverFileProblem({ type: "image/png", size: MAX_COVER_BYTES + 1 })
    ).not.toBeNull();
    expect(
      coverFileProblem({ type: "image/png", size: MAX_COVER_BYTES })
    ).toBeNull();
  });
});

describe("coverStoragePath", () => {
  it("builds course-covers/<id>/<timestamp>.<ext>", () => {
    expect(coverStoragePath(COURSE, 123, "image/webp")).toBe(
      `course-covers/${COURSE}/123.webp`
    );
    expect(coverStoragePath(COURSE, 5, "image/jpeg")).toBe(
      `course-covers/${COURSE}/5.jpg`
    );
  });
});

describe("isAllowedCoverUrl", () => {
  const ok = `${coverPrefix(BASE)}${COURSE}/1.jpg`;
  it("accepts a url in this project's course-covers folder", () => {
    expect(isAllowedCoverUrl(ok, BASE)).toBe(true);
  });
  it("refuses other hosts, buckets and paths", () => {
    expect(isAllowedCoverUrl("https://evil.example/x.jpg", BASE)).toBe(false);
    expect(
      isAllowedCoverUrl(`${BASE}/storage/v1/object/public/avatars/other/1.jpg`, BASE)
    ).toBe(false);
    expect(isAllowedCoverUrl(`${ok}/../../x`, BASE)).toBe(false);
    expect(isAllowedCoverUrl(ok, "")).toBe(false);
  });
});
