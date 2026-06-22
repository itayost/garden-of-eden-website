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
        additional_info: null,
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

  it("falls back to positional parsing when row 1 has no recognised name header", () => {
    // No "שם" header → headerless positional: row 1 is treated as data (its
    // "טלפון" cell is an invalid phone → error), the real lead still imports.
    const input = "עמודה\tטלפון\nדני\t0541234567";
    const result = parseLeadsPaste(input);
    expect(result.valid).toEqual([
      {
        name: "דני",
        phone: "972541234567",
        note: null,
        club: null,
        birth_year: null,
        is_from_haifa: false,
        additional_info: null,
      },
    ]);
    expect(result.errors[0]).toMatchObject({ line: 1, message: "טלפון לא תקין" });
  });

  it("still treats row 1 as a header when a name column is recognised among unknown cells", () => {
    // "שם פרטי" is a recognised name alias even alongside an unknown column.
    const input = "שם פרטי\tעמודה\tטלפון\nדני\t\t0541234567";
    const result = parseLeadsPaste(input);
    expect(result.valid).toEqual([
      {
        name: "דני",
        phone: "972541234567",
        note: null,
        club: null,
        birth_year: null,
        is_from_haifa: false,
        additional_info: null,
      },
    ]);
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

  it("parses a headerless paste positionally as name/phone/additional_info", () => {
    const input = "דני כהן\t0541234567\tמתעניין בקבוצת בוקר\nנועה לוי\t0509876543";
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
        additional_info: "מתעניין בקבוצת בוקר",
      },
      {
        name: "נועה לוי",
        phone: "972509876543",
        note: null,
        club: null,
        birth_year: null,
        is_from_haifa: false,
        additional_info: null,
      },
    ]);
  });

  it("keeps phone in a headerless name+phone paste (regression: phone was dropped)", () => {
    const input = "דני כהן\t0541234567\nנועה לוי\t0509876543";
    const result = parseLeadsPaste(input);
    expect(result.valid.map((r) => r.phone)).toEqual([
      "972541234567",
      "972509876543",
    ]);
  });

  it("maps additional_info via header in any order", () => {
    const input = "שם\tמידע נוסף\tטלפון\nדני\tהגיע מהמלצה\t0541234567";
    const result = parseLeadsPaste(input);
    expect(result.valid[0]).toMatchObject({
      name: "דני",
      phone: "972541234567",
      additional_info: "הגיע מהמלצה",
    });
  });

  it("recognises widened phone-header aliases (פלאפון)", () => {
    const input = "שם\tפלאפון\nדני\t0541234567";
    const result = parseLeadsPaste(input);
    expect(result.valid[0]).toMatchObject({ name: "דני", phone: "972541234567" });
  });

  it("treats a single-name-per-line headerless paste as name-only leads", () => {
    const input = "דני כהן\nנועה לוי";
    const result = parseLeadsPaste(input);
    expect(result.valid).toHaveLength(2);
    expect(result.valid.map((r) => r.name)).toEqual(["דני כהן", "נועה לוי"]);
    expect(result.valid.every((r) => r.phone === null)).toBe(true);
  });

  it("parses a comma-separated headerless paste positionally", () => {
    // No tab anywhere → comma separator; no name header → positional.
    const input = "דני כהן,0541234567,מתעניין\nנועה לוי,0509876543";
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
        additional_info: "מתעניין",
      },
      {
        name: "נועה לוי",
        phone: "972509876543",
        note: null,
        club: null,
        birth_year: null,
        is_from_haifa: false,
        additional_info: null,
      },
    ]);
  });

  it("does not swallow a name-only paste whose first name collides with a phone alias (טל)", () => {
    // "טל" is a phone alias but a common name; with no recognised name header
    // this must parse positionally, not be consumed as a header.
    const input = "טל\nדני\nנועה";
    const result = parseLeadsPaste(input);
    expect(result.valid.map((r) => r.name)).toEqual(["טל", "דני", "נועה"]);
    expect(result.errors).toEqual([]);
  });
});
