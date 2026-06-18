import { describe, it, expect } from "vitest";
import { parseLeadsPaste } from "../parse-leads-paste";

describe("parseLeadsPaste", () => {
  it("returns an empty result for empty input", () => {
    const result = parseLeadsPaste("");
    expect(result.valid).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("parses name + phone with a Hebrew header (tab-separated)", () => {
    const input = "שם\tטלפון\nדני כהן\t0541234567";
    const result = parseLeadsPaste(input);
    expect(result.errors).toEqual([]);
    expect(result.valid).toEqual([
      {
        name: "דני כהן",
        phone: "972541234567",
        note: null,
        club: null,
        birth_year: null,
        is_from_haifa: false,
      },
    ]);
  });

  it("detects columns by header in any order", () => {
    const input = "טלפון\tשם\n0541234567\tדני";
    const result = parseLeadsPaste(input);
    expect(result.valid[0]).toMatchObject({ name: "דני", phone: "972541234567" });
  });

  it("supports English headers and extra mapped columns", () => {
    const input = "name\tphone\tnote\tשנתון\nNoa\t0509876543\thot lead\t2014";
    const result = parseLeadsPaste(input);
    expect(result.valid[0]).toMatchObject({
      name: "Noa",
      phone: "972509876543",
      note: "hot lead",
      birth_year: 2014,
    });
  });

  it("allows a name-only row (no phone)", () => {
    const input = "שם\tטלפון\nדני\t";
    const result = parseLeadsPaste(input);
    expect(result.valid[0]).toMatchObject({ name: "דני", phone: null });
    expect(result.errors).toEqual([]);
  });

  it("normalizes 972-format and 05 phones", () => {
    const input = "שם\tטלפון\nאבי\t972521112222\nבני\t052-111-2222";
    const result = parseLeadsPaste(input);
    expect(result.valid.map((r) => r.phone)).toEqual([
      "972521112222",
      "972521112222",
    ]);
  });

  it("reports an invalid phone as an error row", () => {
    const input = "שם\tטלפון\nדני\t123";
    const result = parseLeadsPaste(input);
    expect(result.valid).toEqual([]);
    expect(result.errors[0]).toMatchObject({ line: 2, message: "טלפון לא תקין" });
  });

  it("reports a missing/short name", () => {
    const input = "שם\tטלפון\n\t0541234567";
    const result = parseLeadsPaste(input);
    expect(result.errors[0]).toMatchObject({ line: 2 });
  });

  it("blocks import when no name column is detected", () => {
    const input = "עמודה\tטלפון\nדני\t0541234567";
    const result = parseLeadsPaste(input);
    expect(result.valid).toEqual([]);
    expect(result.errors[0].message).toContain("עמודת שם");
  });

  it("parses is_from_haifa truthy values", () => {
    const input = "שם\tחיפה\nדני\tכן\nנועה\tלא";
    const result = parseLeadsPaste(input);
    expect(result.valid[0].is_from_haifa).toBe(true);
    expect(result.valid[1].is_from_haifa).toBe(false);
  });

  it("skips blank lines and trims cells", () => {
    const input = "שם\tטלפון\n\n  דני  \t 0541234567 \n\n";
    const result = parseLeadsPaste(input);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0]).toMatchObject({ name: "דני", phone: "972541234567" });
  });
});
