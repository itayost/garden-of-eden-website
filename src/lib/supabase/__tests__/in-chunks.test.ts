import { describe, it, expect } from "vitest";
import { ID_CHUNK, PAGES_AT_ONCE, byFullName, chunk, newestFirst, readAllPages } from "../in-chunks";

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

describe("readAllPages", () => {
  /** An in-memory table read through `range`, recording each page asked for. */
  const table = (size: number, failFrom: number | null = null) => {
    const rows = ids(size);
    const asked: number[] = [];
    const query = () => ({
      range: async (from: number, to: number) => {
        asked.push(from);
        if (failFrom !== null && from >= failFrom) return { data: null, error: { message: "boom" } };
        return { data: rows.slice(from, to + 1), error: null };
      },
    });
    return { rows, asked, query };
  };

  it("takes one request for a read that fits one page", async () => {
    const { rows, asked, query } = table(999);
    expect(await readAllPages(query)).toEqual({ data: rows, error: null });
    expect(asked).toEqual([0]);
  });

  it("reads every row in order across pages", async () => {
    for (const size of [0, 1000, 1001, 2500, 4000, 5000, 5001, 12_345]) {
      const { rows, query } = table(size);
      expect(await readAllPages(query)).toEqual({ data: rows, error: null });
    }
  });

  it("asks for the pages after a full first page in batches", async () => {
    const { asked, query } = table(2500);
    await readAllPages(query);
    expect(asked.sort((a, b) => a - b)).toEqual(
      Array.from({ length: 1 + PAGES_AT_ONCE }, (_, i) => i * 1000),
    );
  });

  it("returns no rows and the error when a page fails", async () => {
    const { query } = table(3000, 2000);
    expect(await readAllPages(query)).toEqual({ data: [], error: { message: "boom" } });
  });
});
