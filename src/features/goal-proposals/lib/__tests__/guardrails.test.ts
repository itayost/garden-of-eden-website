import { describe, expect, it } from "vitest";
import type { CandidateFacts } from "../candidates";
import { checkPicks, MAX_PICK_DRILLS, MAX_PICKS, REASON_MAX_WORDS } from "../guardrails";
import type { ProposalPick } from "../writer/output";

const D = (n: number) => `0000000${n}-1111-4111-8111-11111111111${n}`;

function candidate(metricKey: CandidateFacts["metric_key"], overrides: Partial<CandidateFacts> = {}): CandidateFacts {
  return {
    metric_key: metricKey,
    metric: "ספרינט 10 מטר",
    unit: "שניות",
    direction: "נמוך יותר טוב יותר",
    value: 2.12,
    benchmark: 1.92,
    betterThanPercent: 18,
    groupSize: 34,
    step: 0.1,
    target: 2.02,
    basis: "חצי מהפער לרף הקבוצה",
    positionFit: "מתאים לעמדה",
    drills: [1, 2, 3, 4, 5].map((n) => ({
      id: D(n),
      name: `תרגיל ${n}`,
      why: "4 סטים של 30 מטר, מנוחה של 90 שניות",
      parameter: "האצה",
    })),
    ...overrides,
  };
}

const SPRINT = candidate("sprint_10m");
const JUMP = candidate("jump_2leg_distance", {
  metric: "קפיצה למרחק בשתי רגליים",
  unit: 'ס"מ',
  direction: "גבוה יותר טוב יותר",
  value: 150,
  benchmark: 180,
  step: 15,
  target: 165,
  drills: [],
});
const FLEX = candidate("flexibility_hip", {
  metric: "גמישות אגן",
  unit: 'ס"מ',
  direction: "גבוה יותר טוב יותר",
  value: 9,
  benchmark: 14,
  step: 2.5,
  target: 11.5,
  drills: [{ id: D(7), name: "מתיחת אגן", why: null, parameter: "גמישות" }],
});
const AGILITY = candidate("blaze_spot_time", { metric: "בלייז", unit: "פגיעות", value: 20, benchmark: 30, step: 5, target: 25 });
const CANDIDATES = [SPRINT, JUMP, FLEX, AGILITY];

const OK_REASON = "הפער לרף הקבוצה בספרינט הוא הגדול ביותר, וזה מדד שמשתפר מהר באימון.";

function pick(metricKey: string, reason = OK_REASON, drillIds: string[] = []): ProposalPick {
  return { metric_key: metricKey, reason, drill_ids: drillIds };
}

function onlyPick(reason: string, drillIds: string[] = []) {
  const { picks } = checkPicks(CANDIDATES, { picks: [pick("sprint_10m", reason, drillIds)] });
  expect(picks).toHaveLength(1);
  return picks[0];
}

describe("limits", () => {
  it("three picks, three drills each, 25 words", () => {
    expect(MAX_PICKS).toBe(3);
    expect(MAX_PICK_DRILLS).toBe(3);
    expect(REASON_MAX_WORDS).toBe(25);
  });
});

describe("checkPicks: which picks stay", () => {
  it("keeps the model's order with ranks 1 to 3 and the candidate's own facts", () => {
    const { picks, dropped } = checkPicks(CANDIDATES, {
      picks: [pick("flexibility_hip"), pick("sprint_10m"), pick("jump_2leg_distance")],
    });
    expect(picks.map((p) => [p.candidate.metric_key, p.rank])).toEqual([
      ["flexibility_hip", 1],
      ["sprint_10m", 2],
      ["jump_2leg_distance", 3],
    ]);
    expect(picks[0].candidate).toBe(FLEX);
    expect(dropped).toEqual([]);
  });

  it("drops an unoffered metric, a repeated metric and a fourth pick", () => {
    const { picks, dropped } = checkPicks(CANDIDATES, {
      picks: [
        pick("sprint_10m"),
        pick("kick_power_kaiser"),
        pick("sprint_5m"),
        pick("sprint_10m", "שוב ספרינט."),
        pick("jump_2leg_distance"),
        pick("flexibility_hip"),
        pick("blaze_spot_time"),
      ],
    });
    expect(picks.map((p) => p.candidate.metric_key)).toEqual(["sprint_10m", "jump_2leg_distance", "flexibility_hip"]);
    expect(picks.map((p) => p.rank)).toEqual([1, 2, 3]);
    expect(dropped).toHaveLength(4);
    expect(dropped[0]).toContain("kick_power_kaiser");
    expect(dropped[1]).toContain("sprint_5m");
    expect(dropped[2]).toContain("sprint_10m");
    expect(dropped[3]).toContain("blaze_spot_time");
    expect(new Set(dropped).size).toBe(4);
  });

  it("an answer with no picks keeps none", () => {
    expect(checkPicks(CANDIDATES, { picks: [] })).toEqual({ picks: [], dropped: [] });
  });

  it("no candidates keeps nothing the model names", () => {
    const { picks, dropped } = checkPicks([], { picks: [pick("sprint_10m")] });
    expect(picks).toEqual([]);
    expect(dropped).toHaveLength(1);
  });
});

describe("checkPicks: drills", () => {
  it("keeps offered drill ids with no problem", () => {
    const checked = onlyPick(OK_REASON, [D(2), D(1)]);
    expect(checked.drillIds).toEqual([D(2), D(1)]);
    expect(checked.problems).toEqual([]);
  });

  it("removes an unoffered drill id with its problem", () => {
    const checked = onlyPick(OK_REASON, [D(1), "99999999-1111-4111-8111-111111111119", D(3)]);
    expect(checked.drillIds).toEqual([D(1), D(3)]);
    expect(checked.problems).toEqual([{ code: "drill", text: "נבחר תרגיל שלא הוצע" }]);
    expect(checked.reason).toBe(OK_REASON);
  });

  it("a drill of another candidate is not offered for this one", () => {
    const { picks } = checkPicks([SPRINT, FLEX], { picks: [pick("flexibility_hip", OK_REASON, [D(1), D(7)])] });
    expect(picks[0].drillIds).toEqual([D(7)]);
    expect(picks[0].problems).toEqual([{ code: "drill", text: "נבחר תרגיל שלא הוצע" }]);
  });

  it("keeps three of four offered ids with the count problem", () => {
    const checked = onlyPick(OK_REASON, [D(4), D(1), D(2), D(3)]);
    expect(checked.drillIds).toEqual([D(4), D(1), D(2)]);
    expect(checked.problems).toEqual([{ code: "drill", text: "נבחרו 4 תרגילים, מותר עד 3" }]);
  });

  it("keeps a repeated id once", () => {
    const checked = onlyPick(OK_REASON, [D(1), D(1), D(2)]);
    expect(checked.drillIds).toEqual([D(1), D(2)]);
    expect(checked.problems).toEqual([]);
  });

  it("a candidate with no drills keeps none", () => {
    const { picks } = checkPicks(CANDIDATES, { picks: [pick("jump_2leg_distance", OK_REASON, [])] });
    expect(picks[0].drillIds).toEqual([]);
    expect(picks[0].problems).toEqual([]);
  });
});

describe("checkPicks: the reason", () => {
  it("keeps a good reason, trimmed", () => {
    const checked = onlyPick(`  ${OK_REASON}\n`);
    expect(checked.reason).toBe(OK_REASON);
    expect(checked.problems).toEqual([]);
  });

  it("a number from the candidate passes, with a dot or a comma", () => {
    expect(onlyPick("התוצאה 2.12 רחוקה מהרף של 1.92 בקבוצה.").reason).toBe("התוצאה 2.12 רחוקה מהרף של 1.92 בקבוצה.");
    expect(onlyPick("הרף של הקבוצה הוא 1,92 ויש מקום לשיפור.").reason).toBe("הרף של הקבוצה הוא 1,92 ויש מקום לשיפור.");
  });

  it("a number from the metric label, the standing or the basis passes", () => {
    expect(onlyPick("בספרינט 10 מטר טוב רק מ-18 אחוז מ-34 שחקני הקבוצה.").problems).toEqual([]);
  });

  it("drops a reason with a number that is not in the candidate", () => {
    const checked = onlyPick("שיפור של 12 אחוז יקרב לרף.");
    expect(checked.reason).toBeNull();
    expect(checked.problems).toEqual([{ code: "number", text: "מספר שלא מופיע בנתונים: 12" }]);
  });

  it("drops a reason with a number that appears only in a drill", () => {
    const checked = onlyPick("4 סטים של 30 מטר יקרבו לרף.");
    expect(checked.reason).toBeNull();
    expect(checked.problems).toEqual([
      { code: "number", text: "מספר שלא מופיע בנתונים: 4" },
      { code: "number", text: "מספר שלא מופיע בנתונים: 30" },
    ]);
  });

  it("does not take a drill id's digits as facts", () => {
    expect(onlyPick("לפי 11111111 מבדקים.").reason).toBeNull();
  });

  it("drops a reason of 26 words, keeps one of 25", () => {
    const words = (n: number) => Array.from({ length: n }, () => "מילה").join(" ");
    expect(onlyPick(words(25)).reason).toBe(words(25));
    const checked = onlyPick(words(26));
    expect(checked.reason).toBeNull();
    expect(checked.problems).toEqual([{ code: "length", text: "הנימוק ארוך משורה אחת" }]);
  });

  it("drops a reason with a line break", () => {
    for (const text of ["שורה ראשונה.\nשורה שנייה.", "שורה ראשונה.\r\nשורה שנייה.", "שורה ראשונה.\u2028שורה שנייה."]) {
      const checked = onlyPick(text);
      expect(checked.reason).toBeNull();
      expect(checked.problems).toEqual([{ code: "length", text: "הנימוק ארוך משורה אחת" }]);
    }
  });

  it("drops an empty reason", () => {
    for (const empty of ["", "   ", "\n"]) {
      const checked = onlyPick(empty);
      expect(checked.reason).toBeNull();
      expect(checked.problems).toEqual([{ code: "length", text: "אין נימוק" }]);
    }
  });

  it("drops a reason with a forbidden word", () => {
    const checked = onlyPick("אחרי הפציעה כדאי לבנות את ההאצה מחדש.");
    expect(checked.reason).toBeNull();
    expect(checked.problems).toEqual([{ code: "forbidden_word", text: "מילה אסורה: פציעה" }]);
  });

  it("drops a reason with Arabic-Indic digits", () => {
    const checked = onlyPick("הרף של הקבוצה הוא ١٫٩٢ שניות.");
    expect(checked.reason).toBeNull();
    expect(checked.problems).toEqual([{ code: "number", text: "ספרות שאינן 0 עד 9 בנימוק" }]);
  });

  it("records every problem of a reason, and the drill problem first", () => {
    const checked = onlyPick("12 שבועות בלי כאב.\nעוד שורה.", ["not-offered"]);
    expect(checked.reason).toBeNull();
    expect(checked.problems).toEqual([
      { code: "drill", text: "נבחר תרגיל שלא הוצע" },
      { code: "length", text: "הנימוק ארוך משורה אחת" },
      { code: "number", text: "מספר שלא מופיע בנתונים: 12" },
      { code: "forbidden_word", text: "מילה אסורה: כאב" },
    ]);
  });

  it("a dropped reason leaves the pick and its drills", () => {
    const checked = onlyPick("שיפור של 12 אחוז.", [D(1)]);
    expect(checked.candidate).toBe(SPRINT);
    expect(checked.rank).toBe(1);
    expect(checked.drillIds).toEqual([D(1)]);
  });
});
