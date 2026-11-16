import { describe, expect, it } from "vitest";
import type { BodyFacts, GoalFact } from "../fact-sheet/types";
import { bodyRows, goalLine, isLinkPreviewAgent, planBoxLines, signedChange } from "../report-view";

const BODY: BodyFacts = {
  date: "2026-11-17",
  weightKg: 42.5,
  heightCm: 150.25,
  bmi: 18.94,
  bmiPercentile: 55,
  heightPercentile: 60.4,
  change: { weightKg: 1.2, heightCm: -0.5 },
  dietitianNote: "לשתות יותר מים",
};

const GOAL: GoalFact = {
  metric: "ספרינט 10 מטר",
  baseline: 2.3,
  current: 2.15,
  target: 2,
  unit: "שניות",
  progressPercent: 50,
  status: "בדרך",
};

describe("planBoxLines", () => {
  it("names the sessions left on a Card and the end date", () => {
    expect(planBoxLines({ sessionsLeft: 4, endsOn: "2026-12-12", status: "active" })).toEqual([
      "נשארו 4 אימונים בכרטיסייה",
      "המסלול בתוקף עד 12.12",
    ]);
  });

  it("says one session in the singular", () => {
    expect(planBoxLines({ sessionsLeft: 1, endsOn: "2026-12-12", status: "ending_soon" })[0]).toBe(
      "נשאר אימון אחד בכרטיסייה",
    );
  });

  it("says when no session is left", () => {
    expect(planBoxLines({ sessionsLeft: 0, endsOn: "2026-12-12", status: "ending_soon" })[0]).toBe(
      "לא נשארו אימונים בכרטיסייה",
    );
  });

  it("gives only the end date when the queue holds no Card", () => {
    expect(planBoxLines({ sessionsLeft: null, endsOn: "2027-01-05", status: "active" })).toEqual([
      "המסלול בתוקף עד 5.1",
    ]);
  });

  it("says an expired or cancelled queue ended, without its sessions", () => {
    expect(planBoxLines({ sessionsLeft: 3, endsOn: "2026-11-10", status: "expired" })).toEqual([
      "המסלול הסתיים ב-10.11",
    ]);
    expect(planBoxLines({ sessionsLeft: null, endsOn: "2026-11-10", status: "cancelled" })).toEqual([
      "המסלול הסתיים ב-10.11",
    ]);
  });
});

describe("signedChange", () => {
  it("puts a plus before a rise and a minus before a fall", () => {
    expect(signedChange(1.2)).toBe("+1.2");
    expect(signedChange(-0.5)).toBe("-0.5");
  });

  it("says no change for zero, or for a change that rounds to zero", () => {
    expect(signedChange(0)).toBe("ללא שינוי");
    expect(signedChange(-0.001)).toBe("ללא שינוי");
  });
});

describe("bodyRows", () => {
  it("lists the numbers with their units, the change and the percentiles", () => {
    expect(bodyRows(BODY)).toEqual([
      { label: "משקל", value: '42.5 ק"ג', change: "+1.2" },
      { label: "גובה", value: '150.25 ס"מ', change: "-0.5" },
      { label: "BMI", value: "18.94", change: null },
      { label: "אחוזון BMI", value: "55%", change: null },
      { label: "אחוזון גובה", value: "60.4%", change: null },
    ]);
  });

  it("leaves out a number that was not measured, and the change without an earlier measurement", () => {
    expect(
      bodyRows({ ...BODY, heightCm: null, bmi: null, bmiPercentile: null, heightPercentile: null, change: null }),
    ).toEqual([{ label: "משקל", value: '42.5 ק"ג', change: null }]);
  });

  it("leaves out a change that is unknown", () => {
    const rows = bodyRows({ ...BODY, change: { weightKg: null, heightCm: 0 } });
    expect(rows[0]).toEqual({ label: "משקל", value: '42.5 ק"ג', change: null });
    expect(rows[1]).toEqual({ label: "גובה", value: '150.25 ס"מ', change: "ללא שינוי" });
  });

  it("never shows the dietitian's note as a number row", () => {
    expect(JSON.stringify(bodyRows(BODY))).not.toContain("מים");
  });
});

describe("goalLine", () => {
  it("gives the start, the current value and the target, with the unit once", () => {
    expect(goalLine(GOAL)).toBe("התחלה 2.3 · עכשיו 2.15 · יעד 2 שניות");
  });

  it("leaves out what is not known", () => {
    expect(goalLine({ ...GOAL, baseline: null, current: null })).toBe("יעד 2 שניות");
  });

  it("has no trailing space without a unit", () => {
    expect(goalLine({ ...GOAL, baseline: null, unit: "" })).toBe("עכשיו 2.15 · יעד 2");
  });
});

describe("isLinkPreviewAgent", () => {
  it("knows the WhatsApp and Facebook link preview fetchers", () => {
    expect(isLinkPreviewAgent("WhatsApp/2.23.20.0 A")).toBe(true);
    expect(isLinkPreviewAgent("WhatsApp/2.24.1.0 i")).toBe(true);
    expect(isLinkPreviewAgent("facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)")).toBe(true);
    expect(isLinkPreviewAgent("facebookexternalhit/1.1 Facebot Twitterbot/1.0")).toBe(true);
    expect(isLinkPreviewAgent("TelegramBot (like TwitterBot)")).toBe(true);
  });

  it("treats a missing agent as a preview", () => {
    expect(isLinkPreviewAgent(null)).toBe(true);
    expect(isLinkPreviewAgent("  ")).toBe(true);
  });

  it("lets phone browsers through, including one made by Cubot", () => {
    expect(
      isLinkPreviewAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe(false);
    expect(
      isLinkPreviewAgent(
        "Mozilla/5.0 (Linux; Android 13; CUBOT X30) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36",
      ),
    ).toBe(false);
  });
});
