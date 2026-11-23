import { describe, expect, it } from "vitest";
import {
  coverFileProblem,
  coverObjectPath,
  coverStoragePath,
  coverUrlOrNull,
  isAllowedCoverUrl,
  MAX_COVER_BYTES,
} from "../course-cover-rules";

const BASE = "https://abc.supabase.co";
const COURSE = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const FOLDER = `${BASE}/storage/v1/object/public/avatars/course-covers`;
const OK = `${FOLDER}/${COURSE}/1732300000000.jpg`;

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
  it("caps a cover at 4 MB, under Vercel's 4.5 MB request limit", () => {
    expect(MAX_COVER_BYTES).toBe(4 * 1024 * 1024);
  });
  it("refuses an empty file and one over 4 MB", () => {
    expect(coverFileProblem({ type: "image/png", size: 0 })).not.toBeNull();
    expect(
      coverFileProblem({ type: "image/png", size: MAX_COVER_BYTES + 1 })
    ).toBe("התמונה גדולה מדי (עד 4MB)");
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
  it("lowercases the course id, as the url check expects", () => {
    const lettered = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    expect(coverStoragePath(lettered.toUpperCase(), 5, "image/png")).toBe(
      `course-covers/${lettered}/5.png`
    );
  });
});

describe("isAllowedCoverUrl", () => {
  it("accepts this course's cover in this project's folder", () => {
    expect(isAllowedCoverUrl(OK, BASE, COURSE)).toBe(true);
    expect(isAllowedCoverUrl(`${FOLDER}/${COURSE}/1.png`, BASE, COURSE)).toBe(true);
    expect(isAllowedCoverUrl(`${FOLDER}/${COURSE}/1.webp`, BASE, COURSE)).toBe(true);
  });

  it("accepts it when the project url ends with a slash", () => {
    expect(isAllowedCoverUrl(OK, `${BASE}/`, COURSE)).toBe(true);
  });

  it("compares the course id lowercased", () => {
    const lettered = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const url = `${FOLDER}/${lettered}/1.jpg`;
    expect(isAllowedCoverUrl(url, BASE, lettered.toUpperCase())).toBe(true);
    expect(
      isAllowedCoverUrl(`${FOLDER}/${lettered.toUpperCase()}/1.jpg`, BASE, lettered)
    ).toBe(false);
  });

  it("refuses another course's folder", () => {
    expect(isAllowedCoverUrl(`${FOLDER}/${OTHER}/1.jpg`, BASE, COURSE)).toBe(false);
  });

  it("refuses encoded dot segments, even ones that resolve into this course's folder", () => {
    for (const dots of ["%2e%2e", "%2E%2E", ".%2e", "%2e.", ".."]) {
      expect(
        isAllowedCoverUrl(`${FOLDER}/${OTHER}/${dots}/${COURSE}/1.jpg`, BASE, COURSE)
      ).toBe(false);
      expect(
        isAllowedCoverUrl(`${FOLDER}/${COURSE}/${dots}/${dots}/x/1.jpg`, BASE, COURSE)
      ).toBe(false);
    }
    expect(isAllowedCoverUrl(`${FOLDER}/${COURSE}/%2e/1.jpg`, BASE, COURSE)).toBe(false);
  });

  it("refuses backslash forms", () => {
    expect(
      isAllowedCoverUrl(`${FOLDER}\\${COURSE}\\1.jpg`, BASE, COURSE)
    ).toBe(false);
    expect(
      isAllowedCoverUrl(`${FOLDER}/${OTHER}\\..\\${COURSE}/1.jpg`, BASE, COURSE)
    ).toBe(false);
    expect(
      isAllowedCoverUrl(OK.replace("https://", "https:\\\\"), BASE, COURSE)
    ).toBe(false);
  });

  it("refuses a query string or a fragment, even an empty one", () => {
    expect(isAllowedCoverUrl(`${OK}?download=1`, BASE, COURSE)).toBe(false);
    expect(isAllowedCoverUrl(`${OK}?`, BASE, COURSE)).toBe(false);
    expect(isAllowedCoverUrl(`${OK}#x`, BASE, COURSE)).toBe(false);
    expect(isAllowedCoverUrl(`${OK}#`, BASE, COURSE)).toBe(false);
  });

  it("refuses another origin", () => {
    const path = `/storage/v1/object/public/avatars/course-covers/${COURSE}/1.jpg`;
    expect(isAllowedCoverUrl(`https://evil.example${path}`, BASE, COURSE)).toBe(false);
    expect(
      isAllowedCoverUrl(`https://abc.supabase.co.evil.example${path}`, BASE, COURSE)
    ).toBe(false);
    expect(isAllowedCoverUrl(`http://abc.supabase.co${path}`, BASE, COURSE)).toBe(false);
    expect(isAllowedCoverUrl(`https://abc.supabase.co:8443${path}`, BASE, COURSE)).toBe(false);
  });

  it("refuses a username or password", () => {
    expect(
      isAllowedCoverUrl(OK.replace("https://", "https://user:pass@"), BASE, COURSE)
    ).toBe(false);
    expect(
      isAllowedCoverUrl(OK.replace("https://", "https://user@"), BASE, COURSE)
    ).toBe(false);
  });

  it("refuses other buckets, folders, names and extensions", () => {
    expect(
      isAllowedCoverUrl(`${BASE}/storage/v1/object/public/avatars/other/1.jpg`, BASE, COURSE)
    ).toBe(false);
    expect(
      isAllowedCoverUrl(
        `${BASE}/storage/v1/object/public/course-videos/course-covers/${COURSE}/1.jpg`,
        BASE,
        COURSE
      )
    ).toBe(false);
    expect(isAllowedCoverUrl(`${FOLDER}/${COURSE}/1.gif`, BASE, COURSE)).toBe(false);
    expect(isAllowedCoverUrl(`${FOLDER}/${COURSE}/1.JPG`, BASE, COURSE)).toBe(false);
    expect(isAllowedCoverUrl(`${FOLDER}/${COURSE}/1.jpg.html`, BASE, COURSE)).toBe(false);
    expect(isAllowedCoverUrl(`${FOLDER}/${COURSE}/cover.jpg`, BASE, COURSE)).toBe(false);
    expect(
      isAllowedCoverUrl(`${FOLDER}/${COURSE}/12345678901234567.jpg`, BASE, COURSE)
    ).toBe(false);
    expect(isAllowedCoverUrl(`${FOLDER}/${COURSE}/x/1.jpg`, BASE, COURSE)).toBe(false);
    expect(isAllowedCoverUrl(`${FOLDER}//${COURSE}/1.jpg`, BASE, COURSE)).toBe(false);
    expect(isAllowedCoverUrl(`${OK}/`, BASE, COURSE)).toBe(false);
  });

  it("refuses when the url or the project url cannot be read", () => {
    expect(isAllowedCoverUrl(OK, "", COURSE)).toBe(false);
    expect(isAllowedCoverUrl(OK, "not a url", COURSE)).toBe(false);
    expect(isAllowedCoverUrl("not a url", BASE, COURSE)).toBe(false);
    expect(isAllowedCoverUrl("", BASE, COURSE)).toBe(false);
  });
});

describe("coverUrlOrNull", () => {
  it("keeps a stored cover that passes the check", () => {
    expect(coverUrlOrNull(OK, BASE, COURSE)).toBe(OK);
  });
  it("drops a stored cover that fails it, and passes null through", () => {
    expect(coverUrlOrNull(`${FOLDER}/${OTHER}/1.jpg`, BASE, COURSE)).toBeNull();
    expect(coverUrlOrNull("https://evil.example/x.jpg", BASE, COURSE)).toBeNull();
    expect(coverUrlOrNull(null, BASE, COURSE)).toBeNull();
  });
});

describe("coverObjectPath", () => {
  it("gives the storage path of this course's cover", () => {
    expect(coverObjectPath(OK, BASE, COURSE)).toBe(
      `course-covers/${COURSE}/1732300000000.jpg`
    );
  });
  it("gives null for anything outside this course's folder", () => {
    expect(coverObjectPath(`${FOLDER}/${OTHER}/1.jpg`, BASE, COURSE)).toBeNull();
    expect(
      coverObjectPath(`${FOLDER}/${OTHER}/%2e%2e/${COURSE}/1.jpg`, BASE, COURSE)
    ).toBeNull();
    expect(coverObjectPath("https://evil.example/x.jpg", BASE, COURSE)).toBeNull();
    expect(coverObjectPath(null, BASE, COURSE)).toBeNull();
  });
});
