import { describe, it, expect } from "vitest";
import { parseChurnedPaste } from "../parse-churned-paste";

describe("parseChurnedPaste", () => {
  it("returns an empty result for empty input", () => {
    const result = parseChurnedPaste("");
    expect(result.valid).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("parses tab-separated name and date", () => {
    const result = parseChurnedPaste("דני כהן\t01/04/2026");
    expect(result.valid).toEqual([{ name: "דני כהן", endDate: "2026-04-01" }]);
    expect(result.errors).toEqual([]);
  });

  it("parses comma-separated name and date", () => {
    const result = parseChurnedPaste("נועה לוי,15/03/2026");
    expect(result.valid).toEqual([{ name: "נועה לוי", endDate: "2026-03-15" }]);
  });

  it("accepts yyyy-mm-dd format", () => {
    const result = parseChurnedPaste("דני\t2026-04-01");
    expect(result.valid).toEqual([{ name: "דני", endDate: "2026-04-01" }]);
  });

  it("accepts dd.mm.yyyy format", () => {
    const result = parseChurnedPaste("דני\t01.04.2026");
    expect(result.valid).toEqual([{ name: "דני", endDate: "2026-04-01" }]);
  });

  it("skips empty lines and trims whitespace", () => {
    const input = "\n  דני\t01/04/2026  \n\n  נועה\t15/03/2026\n";
    const result = parseChurnedPaste(input);
    expect(result.valid).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
  });

  it("reports rows missing a separator", () => {
    const result = parseChurnedPaste("דני כהן");
    expect(result.valid).toEqual([]);
    expect(result.errors).toEqual([
      { line: 1, raw: "דני כהן", message: "חסר תאריך סיום" },
    ]);
  });

  it("reports rows with empty name", () => {
    const result = parseChurnedPaste("\t01/04/2026");
    expect(result.errors).toEqual([
      { line: 1, raw: "\t01/04/2026", message: "חסר שם" },
    ]);
  });

  it("reports rows with invalid date", () => {
    const result = parseChurnedPaste("דני\t32/13/2026");
    expect(result.errors[0]).toMatchObject({
      line: 1,
      message: "תאריך לא תקין",
    });
  });

  it("returns valid rows and errors from a mixed paste", () => {
    const input = ["דני\t01/04/2026", "bad line", "נועה\t15/03/2026"].join(
      "\n",
    );
    const result = parseChurnedPaste(input);
    expect(result.valid).toHaveLength(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].line).toBe(2);
  });
});
