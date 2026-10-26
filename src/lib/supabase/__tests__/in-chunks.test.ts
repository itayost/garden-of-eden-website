import { describe, it, expect } from "vitest";
import { ID_CHUNK, byFullName, chunk, newestFirst } from "../in-chunks";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `id-${i}`);

describe("chunk", () => {
  it("returns no slices for no items", () => {
    expect(chunk([])).toEqual([]);
  });

  it("splits into slices of the given size, the last one short", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("keeps an exact multiple in full slices", () => {
    expect(chunk(ids(ID_CHUNK * 2)).map((slice) => slice.length)).toEqual([ID_CHUNK, ID_CHUNK]);
  });

  it("keeps every uuid slice under the gateway's URL cap", () => {
    // 36 characters a uuid, plus an encoded comma.
    expect(ID_CHUNK * (36 + 3)).toBeLessThan(24_800);
  });
});

describe("byFullName", () => {
  it("orders Hebrew names as the database does, nulls last", () => {
    const names = ["תמר", null, "אביב", "דניאל קמרט", "ךלי", "כרמל", "אבי", "דניאל"];
    const sorted = names.map((full_name) => ({ full_name })).sort(byFullName).map((p) => p.full_name);
    // The production database's own order for the same names.
    expect(sorted).toEqual(["אבי", "אביב", "דניאל", "דניאל קמרט", "ךלי", "כרמל", "תמר", null]);
  });
});

describe("newestFirst", () => {
  it("orders timestamps newest first, fractions of a second included", () => {
    const rows = [
      "2026-10-26T12:14:39+00:00",
      "2026-10-26T12:14:40+00:00",
      "2026-10-26T12:14:39.07+00:00",
      "2026-10-26T12:14:39.5+00:00",
      "2026-10-26T12:14:39.073464+00:00",
    ].map((submitted_at) => ({ submitted_at }));
    expect(rows.sort(newestFirst("submitted_at")).map((row) => row.submitted_at)).toEqual([
      "2026-10-26T12:14:40+00:00",
      "2026-10-26T12:14:39.5+00:00",
      "2026-10-26T12:14:39.073464+00:00",
      "2026-10-26T12:14:39.07+00:00",
      "2026-10-26T12:14:39+00:00",
    ]);
  });

  it("puts a missing timestamp first, as a descending order in Postgres does", () => {
    const rows = [{ created_at: "2026-10-26T12:14:39+00:00" }, { created_at: null }];
    expect(rows.sort(newestFirst("created_at")).map((row) => row.created_at)).toEqual([
      null,
      "2026-10-26T12:14:39+00:00",
    ]);
  });
});
