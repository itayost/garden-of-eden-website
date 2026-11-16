import { describe, expect, it } from "vitest";
import {
  approveAllSchema,
  genderSchema,
  holdSchema,
  reportIdSchema,
  settingsSchema,
  textsSchema,
} from "../weekly-reports";

const REPORT = "11111111-1111-4111-8111-111111111111";
const BRANCH = "22222222-2222-4222-8222-222222222222";

/** The first issue's message, or null when the input parsed. */
function firstMessage(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.success ? null : (result.error?.issues[0]?.message ?? null);
}

describe("reportIdSchema", () => {
  it("accepts a uuid and refuses anything else", () => {
    expect(reportIdSchema.safeParse({ reportId: REPORT }).success).toBe(true);
    expect(reportIdSchema.safeParse({ reportId: "x" }).success).toBe(false);
    expect(reportIdSchema.safeParse({}).success).toBe(false);
  });
});

describe("the version a screen showed", () => {
  const VERSION = "2026-11-20T08:15:42.123456+00:00";

  it("is optional and kept as it was sent", () => {
    expect(reportIdSchema.parse({ reportId: REPORT }).version).toBeUndefined();
    expect(reportIdSchema.parse({ reportId: REPORT, version: VERSION }).version).toBe(VERSION);
    expect(holdSchema.parse({ reportId: REPORT, reason: "לבדוק", version: VERSION }).version).toBe(VERSION);
    expect(
      textsSchema.parse({ reportId: REPORT, playerText: "א", parentText: "ב", version: VERSION }).version,
    ).toBe(VERSION);
    expect(genderSchema.parse({ reportId: REPORT, gender: "male", version: VERSION }).version).toBe(VERSION);
  });

  it("refuses an empty, over-long or non-string version", () => {
    expect(reportIdSchema.safeParse({ reportId: REPORT, version: "" }).success).toBe(false);
    expect(reportIdSchema.safeParse({ reportId: REPORT, version: "1".repeat(65) }).success).toBe(false);
    expect(reportIdSchema.safeParse({ reportId: REPORT, version: 12 }).success).toBe(false);
  });
});

describe("approveAllSchema", () => {
  it("accepts a Friday with or without a branch", () => {
    expect(approveAllSchema.safeParse({ weekStart: "2026-11-13" }).success).toBe(true);
    expect(approveAllSchema.safeParse({ weekStart: "2026-11-13", filterBranchId: BRANCH }).success).toBe(true);
  });

  it("refuses a day that is not a Friday, a bad date or a bad branch id", () => {
    expect(approveAllSchema.safeParse({ weekStart: "2026-11-12" }).success).toBe(false);
    expect(approveAllSchema.safeParse({ weekStart: "2026-02-30" }).success).toBe(false);
    expect(approveAllSchema.safeParse({ weekStart: "2026-11-13", filterBranchId: "x" }).success).toBe(false);
  });
});

describe("holdSchema", () => {
  it("trims the reason", () => {
    expect(holdSchema.parse({ reportId: REPORT, reason: "  לבדוק עם המאמן  " }).reason).toBe("לבדוק עם המאמן");
  });

  it("refuses a one-character reason, also after trimming", () => {
    expect(holdSchema.safeParse({ reportId: REPORT, reason: "א" }).success).toBe(false);
    expect(holdSchema.safeParse({ reportId: REPORT, reason: " א " }).success).toBe(false);
  });

  it("accepts 200 characters and refuses 201", () => {
    expect(holdSchema.safeParse({ reportId: REPORT, reason: "א".repeat(200) }).success).toBe(true);
    expect(holdSchema.safeParse({ reportId: REPORT, reason: "א".repeat(201) }).success).toBe(false);
  });
});

describe("textsSchema", () => {
  const texts = { reportId: REPORT, playerText: "טקסט לשחקן", parentText: "טקסט להורה" };

  it("trims both texts", () => {
    const parsed = textsSchema.parse({ ...texts, playerText: "  שלום  ", parentText: "\nהיי\n" });
    expect(parsed.playerText).toBe("שלום");
    expect(parsed.parentText).toBe("היי");
  });

  it("accepts 2,000 characters and refuses 2,001", () => {
    expect(textsSchema.safeParse({ ...texts, playerText: "א".repeat(2000) }).success).toBe(true);
    expect(textsSchema.safeParse({ ...texts, playerText: "א".repeat(2001) }).success).toBe(false);
    expect(textsSchema.safeParse({ ...texts, parentText: "א".repeat(2001) }).success).toBe(false);
  });

  it("refuses an empty text", () => {
    expect(textsSchema.safeParse({ ...texts, playerText: "   " }).success).toBe(false);
    expect(textsSchema.safeParse({ ...texts, parentText: "" }).success).toBe(false);
  });
});

describe("genderSchema", () => {
  it("accepts male and female only", () => {
    expect(genderSchema.safeParse({ reportId: REPORT, gender: "male" }).success).toBe(true);
    expect(genderSchema.safeParse({ reportId: REPORT, gender: "female" }).success).toBe(true);
    expect(firstMessage(genderSchema.safeParse({ reportId: REPORT, gender: "other" }))).toBe("יש לבחור בן או בת");
  });
});

describe("settingsSchema", () => {
  const settings = { branchId: BRANCH, mode: "approval", birthYears: [2013, 2014], missedYou: true };

  it("accepts off and approval", () => {
    expect(settingsSchema.safeParse(settings).success).toBe(true);
    expect(settingsSchema.safeParse({ ...settings, mode: "off" }).success).toBe(true);
  });

  it("refuses automatic with its message", () => {
    expect(firstMessage(settingsSchema.safeParse({ ...settings, mode: "automatic" }))).toBe(
      "מצב אוטומטי ייפתח בשלב מאוחר יותר",
    );
  });

  it("refuses an unknown mode", () => {
    expect(firstMessage(settingsSchema.safeParse({ ...settings, mode: "sometimes" }))).toBe("מצב לא תקין");
  });

  it("refuses a duplicate birth year", () => {
    expect(settingsSchema.safeParse({ ...settings, birthYears: [2013, 2013] }).success).toBe(false);
  });

  it("refuses a birth year outside 1950 to 2030", () => {
    expect(settingsSchema.safeParse({ ...settings, birthYears: [1949] }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...settings, birthYears: [2031] }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...settings, birthYears: [1950, 2030] }).success).toBe(true);
  });

  it("refuses a fractional year and more than 30 years", () => {
    expect(settingsSchema.safeParse({ ...settings, birthYears: [2013.5] }).success).toBe(false);
    const years = Array.from({ length: 31 }, (_, i) => 1990 + i);
    expect(settingsSchema.safeParse({ ...settings, birthYears: years }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...settings, birthYears: years.slice(0, 30) }).success).toBe(true);
  });

  it("takes null, or an empty list, as every year", () => {
    expect(settingsSchema.parse({ ...settings, birthYears: null }).birthYears).toBeNull();
    expect(settingsSchema.parse({ ...settings, birthYears: [] }).birthYears).toBeNull();
  });

  it("refuses a bad branch id or a missing switch", () => {
    expect(settingsSchema.safeParse({ ...settings, branchId: "x" }).success).toBe(false);
    expect(settingsSchema.safeParse({ branchId: BRANCH, mode: "off", birthYears: null }).success).toBe(false);
  });
});
