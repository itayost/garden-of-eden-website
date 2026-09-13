import { describe, it, expect } from "vitest";
import {
  emptyCell,
  resizeRowCells,
  copyCellAcrossWeeks,
  deriveSubCategories,
  deriveMainCategories,
  normalizeCategoryName,
  findSimilarCategory,
} from "../grid-utils";

const cell = (week: number, reps: string) => ({ week, sets: 3, repsHe: reps, loadHe: "70%", notesHe: "" });

describe("resizeRowCells", () => {
  it("pads with empty cells when growing", () => {
    const out = resizeRowCells([cell(1, "8")], 3);
    expect(out).toHaveLength(3);
    expect(out[0].repsHe).toBe("8");
    expect(out[1]).toEqual(emptyCell(2));
    expect(out[2]).toEqual(emptyCell(3));
  });
  it("truncates when shrinking and re-stamps weeks", () => {
    const out = resizeRowCells([cell(1, "8"), cell(2, "6"), cell(3, "4")], 2);
    expect(out.map((c) => c.week)).toEqual([1, 2]);
    expect(out).toHaveLength(2);
  });
  it("places cells by their week field regardless of input order", () => {
    // Cells arriving out of order (e.g. unordered DB rows) must land in the
    // slot matching their own `week`, not their array position.
    const out = resizeRowCells([cell(2, "6"), cell(1, "8")], 2);
    expect(out.map((c) => c.week)).toEqual([1, 2]);
    expect(out.map((c) => c.repsHe)).toEqual(["8", "6"]);
  });
});

describe("copyCellAcrossWeeks", () => {
  it("copies the source week's values to every week, keeping week numbers", () => {
    const out = copyCellAcrossWeeks([cell(1, "8"), emptyCell(2), emptyCell(3)], 0);
    expect(out.map((c) => c.repsHe)).toEqual(["8", "8", "8"]);
    expect(out.map((c) => c.week)).toEqual([1, 2, 3]);
  });
});

describe("deriveSubCategories", () => {
  const ex = [
    { mainCategory: "כוח", subCategory: "שוקיים" },
    { mainCategory: "כוח", subCategory: "ארבע ראשי" },
    { mainCategory: "אירובי", subCategory: "MAS" },
    { mainCategory: "כוח", subCategory: "שוקיים" },
  ];
  it("returns distinct sorted sub-categories for a main category", () => {
    expect(deriveSubCategories(ex, "כוח")).toEqual(["ארבע ראשי", "שוקיים"]);
  });
  it("returns all distinct when no main category given", () => {
    expect(deriveSubCategories(ex)).toEqual(["MAS", "ארבע ראשי", "שוקיים"]);
  });
});

describe("normalizeCategoryName", () => {
  it("trims and collapses inner whitespace", () => {
    expect(normalizeCategoryName("  כוח   מתפרץ  ")).toBe("כוח מתפרץ");
  });
  it("returns an empty string when there is nothing usable", () => {
    expect(normalizeCategoryName("   ")).toBe("");
    expect(normalizeCategoryName(null)).toBe("");
    expect(normalizeCategoryName(undefined)).toBe("");
  });
});

describe("deriveMainCategories", () => {
  it("returns distinct sorted categories", () => {
    const out = deriveMainCategories([
      { mainCategory: "כוח" },
      { mainCategory: "אירובי" },
      { mainCategory: "כוח" },
    ]);
    expect(out).toEqual(["אירובי", "כוח"]);
  });
  it("normalizes spacing so one category cannot appear twice", () => {
    expect(deriveMainCategories([{ mainCategory: "כוח  מתפרץ" }, { mainCategory: "כוח מתפרץ" }]))
      .toEqual(["כוח מתפרץ"]);
  });
  it("skips blank categories", () => {
    expect(deriveMainCategories([{ mainCategory: "  " }, { mainCategory: "אירובי" }]))
      .toEqual(["אירובי"]);
  });
});

describe("findSimilarCategory", () => {
  const existing = ["כוח - פלג גוף תחתון", "אירובי וסיבולת", "Core"];

  it("matches a name that differs only in spacing", () => {
    expect(findSimilarCategory("אירובי  וסיבולת", existing)).toBe("אירובי וסיבולת");
  });
  it("matches across dash shapes, which read identically to a human", () => {
    expect(findSimilarCategory("כוח – פלג גוף תחתון", existing)).toBe("כוח - פלג גוף תחתון");
  });
  it("matches regardless of case for latin names", () => {
    expect(findSimilarCategory("core", existing)).toBe("Core");
  });
  it("returns null for a name that is already exactly in the list", () => {
    expect(findSimilarCategory("אירובי וסיבולת", existing)).toBeNull();
  });
  it("returns null when nothing is close", () => {
    expect(findSimilarCategory("קואורדינציה", existing)).toBeNull();
    expect(findSimilarCategory("   ", existing)).toBeNull();
  });
});
