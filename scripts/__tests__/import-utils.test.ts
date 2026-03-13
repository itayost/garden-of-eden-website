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
  parseStandardColumnar,
  parseReorderedColumnar,
  parseVerticalCard,
  parseVerticalLabeled,
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

describe("parseStandardColumnar", () => {
  it("parses standard row with all fields", () => {
    const lines = [
      "שם השחקן,ניתור שיא לגובה,ניתור 2 רגליים,ניתור רגל אחת,5 מטר,10 מטר,גמישות,יציבות,קואורדינציה,טכניקת ריצה,חשיבה מהירה",
      "איתי בן דוד,204 7%,2.35,רגל ימין 2.30 - רגל שמאל 2.35,0.86,1.66,0,0,0,0,",
    ];
    const content = lines.join("\n");
    const result = parseStandardColumnar(content, "test.csv", "2024-08-01");
    expect(result).toHaveLength(1);
    expect(result[0].csv_name).toBe("איתי בן דוד");
    expect(result[0].sprint_5m).toBe(0.86);
    expect(result[0].sprint_10m).toBe(1.66);
    expect(result[0].jump_2leg_distance).toBe(235);
    expect(result[0].jump_2leg_height).toBe(204);
    expect(result[0].kick_power_kaiser).toBe(7);
  });

  it("filters header and empty rows", () => {
    const lines = [
      "שם השחקן,col1,col2,col3,col4,col5,col6,col7,col8,col9,col10",
      "שם שחקן,,,,,,,,,,,",
      ",,,,,,,,,,",
      "איתי,,,,,,,,,,,",
    ];
    const result = parseStandardColumnar(lines.join("\n"), "test.csv", "2024-07-01");
    expect(result).toHaveLength(1);
    expect(result[0].csv_name).toBe("איתי");
  });

  it("auto-corrects sprint > 30", () => {
    const lines = [
      "שם,col1,col2,col3,col4,col5,col6,col7,col8,col9,col10",
      "player,,,,1.27,240,,,,,,",
    ];
    const result = parseStandardColumnar(lines.join("\n"), "test.csv", "2024-03-01");
    expect(result[0].sprint_10m).toBe(2.4);
    expect(result[0].warnings).toEqual(expect.arrayContaining([expect.stringContaining("auto-corrected")]));
  });
});

describe("parseReorderedColumnar", () => {
  it("maps columns by header keywords", () => {
    const lines = [
      "אי,ניתור שיא לגובה,ניתור רגל ימין למרחק, 30 שניות בלייז ספוט,ניתור 2 רגליים למרחק,ניתור רגל שאמאל למרחק,מהירות שיא 5 מטר,מהירות שיא 10 מטר קו ישר,גמישות,יציבות,קואורדינציה,טכניקת ריצה, זריזות מהירות אלכסונים 10 מטר,זריזות מהירות אלכסונים 5 מטר",
      'לואי כאוכב,83%,1.38,33,,1.48,"1,05","2,08",0,0,0,0,8.75,3.92',
    ];
    const result = parseReorderedColumnar(lines.join("\n"), "nov.csv", "2024-11-01");
    expect(result).toHaveLength(1);
    expect(result[0].csv_name).toBe("לואי כאוכב");
    expect(result[0].kick_power_kaiser).toBe(83);
    expect(result[0].jump_right_leg).toBe(138);
    expect(result[0].blaze_spot_time).toBe(33);
    expect(result[0].jump_left_leg).toBe(148);
    expect(result[0].sprint_5m).toBe(1.05);
    expect(result[0].sprint_10m).toBe(2.08);
  });

  it("handles sub-table with two height columns", () => {
    const lines = [
      "שם,ניתור לגובה 3.5,ניתור לגובה 5,קפיצה למרחק 2 רגליים,קפיצה למרחק רגל ימין,קפיצה למרחק רגל שמאל,זריזות 4 פודים חצי דקה TO 1.25,ספרינט 5מ,ספרינט 10מ",
      "אייל סוויד,198,235,2.12,1.73,2,44,4.71,6.56",
    ];
    const result = parseReorderedColumnar(lines.join("\n"), "nov.csv", "2024-11-01");
    expect(result[0].jump_2leg_height).toBe(235);
    expect(result[0].jump_2leg_distance).toBe(212);
    expect(result[0].blaze_spot_time).toBe(44);
  });
});

describe("parseVerticalCard", () => {
  it("parses vertical card with two attempts, takes best", () => {
    const content = [
      'יהב סיוון,,,,,,,,,,,,,',
      ',,,,,,,,,,,,,',
      '"5 מ - 5.32, 5.40",,,,,,,,,,,,,',
      '"10 מ - 7.58, 7.60",,,,,,,,,,,,,',
      '"קפיצה שתי רגליים - 2.27, 2.30",,,,,,,,,,,,,',
      '"שמאל - 2.00, 1.91",,,,,,,,,,,,,',
      '"ימין - 1.90, 2.10",,,,,,,,,,,,,',
    ].join("\n");
    const result = parseVerticalCard(content, "nov.csv", "2024-11-01");
    expect(result).toHaveLength(1);
    expect(result[0].csv_name).toBe("יהב סיוון");
    expect(result[0].sprint_5m).toBe(5.32);
    expect(result[0].sprint_10m).toBe(7.58);
    expect(result[0].jump_2leg_distance).toBe(230);
    expect(result[0].jump_left_leg).toBe(200);
    expect(result[0].jump_right_leg).toBe(210);
  });

  it("flushes last player at EOF", () => {
    const content = [
      'player name,,,,,,,,,,,,,',
      '"5 מ - 1.05, 1.10",,,,,,,,,,,,,',
    ].join("\n");
    const result = parseVerticalCard(content, "test.csv", "2024-11-01");
    expect(result).toHaveLength(1);
  });

  it("stores text notes in warnings", () => {
    const content = [
      'נועם בן דניו,,,,,,,,,,,,,',
      ',,,,,,,,,,,,,',
      '"קרסוליים קשיחות, לא הכי יציב, קושי בשינויי כיוון",,,,,,,,,,,,,',
      '"5 מ - 6.93, 6.61",,,,,,,,,,,,,',
      '"10 מ - 9.18, 9.35",,,,,,,,,,,,,',
    ].join("\n");
    const result = parseVerticalCard(content, "test.csv", "2024-11-01");
    expect(result[0].warnings).toEqual(expect.arrayContaining([
      expect.stringContaining("קרסוליים"),
    ]));
  });
});

describe("parseVerticalLabeled", () => {
  it("parses Kawkab-style vertical blocks", () => {
    const content = [
      ",,,,,,,,,,אדהם,חודש נובמבר",
      ",,,,,,,,,,5 מטר: 1.03,",
      ",,,,,,,,,,10 מטר: 1.88,",
      ",,,,,,,,,,קפיצה שתי רגליים: 2.17,",
      ",,,,,,,,,,רגל ימין: 1.90,",
      ",,,,,,,,,,רגל שמאל: 2.05,",
      ",,,,,,,,,,זריזות: 5.36,",
      ",,,,,,,,,,,",
      ",,,,,,,,,,אדם,",
      ",,,,,,,,,,5 מטר: 1.09,",
      ",,,,,,,,,,10 מטר: 1.98,",
    ].join("\n");
    const result = parseVerticalLabeled(content, "kawkab.csv", "2024-11-01");
    expect(result).toHaveLength(2);
    expect(result[0].csv_name).toBe("אדהם");
    expect(result[0].sprint_5m).toBe(1.03);
    expect(result[0].sprint_10m).toBe(1.88);
    expect(result[0].jump_2leg_distance).toBe(217);
    expect(result[0].jump_right_leg).toBe(190);
    expect(result[0].jump_left_leg).toBe(205);
    expect(result[1].csv_name).toBe("אדם");
    expect(result[1].sprint_5m).toBe(1.09);
  });

  it("drops זריזות field", () => {
    const content = [
      ",,,,,,,,,,player,",
      ",,,,,,,,,,זריזות: 5.36,",
    ].join("\n");
    const result = parseVerticalLabeled(content, "test.csv", "2024-11-01");
    expect(result[0].sprint_5m).toBeNull();
  });
});
