import { describe, it, expect } from "vitest";
import {
  extractNumber,
  normalizeToCm,
  normalizeSprint,
  parseKaiserHeight,
  parseSingleLegJump,
  mapCoordination,
  parseBlazeSpot,
  normalizeName,
  findProfileMatch,
  isHeaderOrMetadata,
} from "../import-utils";

describe("extractNumber", () => {
  it("extracts plain number", () => {
    expect(extractNumber("1.23")).toBe(1.23);
  });
  it("handles comma decimal separator", () => {
    expect(extractNumber("1,23")).toBe(1.23);
  });
  it("strips Hebrew text", () => {
    expect(extractNumber("188 ס\"מ")).toBe(188);
  });
  it("returns null for ?", () => {
    expect(extractNumber("?")).toBeNull();
  });
  it("returns null for ??", () => {
    expect(extractNumber("??")).toBeNull();
  });
  it("returns null for 0", () => {
    expect(extractNumber("0")).toBeNull();
  });
  it("returns null for empty", () => {
    expect(extractNumber("")).toBeNull();
  });
});

describe("parseKaiserHeight", () => {
  it("splits 188 7% into height=188, kaiser=7", () => {
    const result = parseKaiserHeight("188 7%");
    expect(result.jumpHeight).toBe(188);
    expect(result.kickPower).toBe(7);
  });
  it("handles 204 7%", () => {
    const result = parseKaiserHeight("204 7%");
    expect(result.jumpHeight).toBe(204);
    expect(result.kickPower).toBe(7);
  });
  it("handles 83 3%", () => {
    const result = parseKaiserHeight("83 3%");
    expect(result.jumpHeight).toBe(83);
    expect(result.kickPower).toBe(3);
  });
  it("handles 230% (% overrides magnitude threshold)", () => {
    const result = parseKaiserHeight("230%");
    expect(result.jumpHeight).toBeNull();
    expect(result.kickPower).toBe(230);
  });
  it("handles 65% (standalone percentage)", () => {
    const result = parseKaiserHeight("65%");
    expect(result.jumpHeight).toBeNull();
    expect(result.kickPower).toBe(65);
  });
  it("handles plain number > 20 as height only", () => {
    const result = parseKaiserHeight("150");
    expect(result.jumpHeight).toBe(150);
    expect(result.kickPower).toBeNull();
  });
  it("handles empty string", () => {
    const result = parseKaiserHeight("");
    expect(result.jumpHeight).toBeNull();
    expect(result.kickPower).toBeNull();
  });
  it("handles 5- 124 pattern (platform height)", () => {
    const result = parseKaiserHeight("5- 124");
    expect(result.jumpHeight).toBe(124);
  });
  it("handles 84 3% with space", () => {
    const result = parseKaiserHeight("84 3%");
    expect(result.jumpHeight).toBe(84);
    expect(result.kickPower).toBe(3);
  });
  it("handles 7% 239 (reversed order)", () => {
    const result = parseKaiserHeight("7% 239");
    expect(result.jumpHeight).toBe(239);
    expect(result.kickPower).toBe(7);
  });
});

describe("normalizeToCm", () => {
  it("converts meters to cm for values < 10", () => {
    expect(normalizeToCm(1.97)).toBe(197);
  });
  it("leaves cm values unchanged", () => {
    expect(normalizeToCm(150)).toBe(150);
  });
});

describe("normalizeSprint", () => {
  it("auto-corrects values > 30 by dividing by 100", () => {
    expect(normalizeSprint(240).result).toBe(2.4);
    expect(normalizeSprint(240).warning).toContain("auto-corrected");
  });
  it("passes through normal values", () => {
    expect(normalizeSprint(1.23).result).toBe(1.23);
    expect(normalizeSprint(1.23).warning).toBeNull();
  });
});

describe("mapCoordination", () => {
  it("maps 1 to deficient", () => {
    expect(mapCoordination("1")).toBe("deficient");
  });
  it("maps 2-3 to basic", () => {
    expect(mapCoordination("2")).toBe("basic");
    expect(mapCoordination("3")).toBe("basic");
  });
  it("maps 4-5 to advanced", () => {
    expect(mapCoordination("4")).toBe("advanced");
    expect(mapCoordination("5")).toBe("advanced");
  });
  it("returns null for 0", () => {
    expect(mapCoordination("0")).toBeNull();
  });
});

describe("parseBlazeSpot", () => {
  it("extracts integer from plain number", () => {
    expect(parseBlazeSpot("38")).toBe(38);
  });
  it("extracts from text like '38 חצי דקה'", () => {
    expect(parseBlazeSpot("38 חצי דקה")).toBe(38);
  });
  it("returns null for empty", () => {
    expect(parseBlazeSpot("")).toBeNull();
  });
});

describe("isHeaderOrMetadata", () => {
  it("identifies Hebrew headers", () => {
    expect(isHeaderOrMetadata("שם השחקן")).toBe(true);
    expect(isHeaderOrMetadata("שם")).toBe(true);
    expect(isHeaderOrMetadata("כ")).toBe(true);
  });
  it("identifies metadata rows", () => {
    expect(isHeaderOrMetadata("תשאירו שורה ריקה")).toBe(true);
  });
  it("allows regular names", () => {
    expect(isHeaderOrMetadata("איתי בן דוד")).toBe(false);
  });
  it("filters empty strings", () => {
    expect(isHeaderOrMetadata("")).toBe(true);
  });
});

describe("findProfileMatch", () => {
  const profiles = [
    { id: "1", full_name: "איתי בן דוד" },
    { id: "2", full_name: "נועם קופלוביץ" },
    { id: "3", full_name: "רועי זהבי" },
  ];

  it("finds exact match", () => {
    const result = findProfileMatch("איתי בן דוד", profiles);
    expect(result.confidence).toBe("exact");
    expect(result.profile?.id).toBe("1");
  });
  it("finds partial match", () => {
    const result = findProfileMatch("איתי בן דוד ", profiles);
    expect(result.profile?.id).toBe("1");
  });
  it("finds token match with typo", () => {
    const result = findProfileMatch("נועם קופליביץ", profiles);
    expect(result.confidence).toBe("token");
    expect(result.profile?.id).toBe("2");
  });
  it("returns none for unmatched name", () => {
    const result = findProfileMatch("זוזו", profiles);
    expect(result.confidence).toBe("none");
    expect(result.profile).toBeNull();
  });
});
