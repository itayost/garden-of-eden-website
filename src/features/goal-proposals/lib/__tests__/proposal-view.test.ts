import { describe, expect, it } from "vitest";
import type { CandidateFacts } from "../candidates";
import {
  droppedReasonLine,
  factsOf,
  groupByTrainee,
  sensitiveNotes,
  standingLine,
  targetLine,
  type ProposalView,
} from "../proposal-view";

const FACTS: CandidateFacts = {
  metric_key: "sprint_10m",
  metric: "ספרינט 10 מטר",
  unit: "שניות",
  direction: "נמוך יותר טוב יותר",
  value: 2.1,
  benchmark: 1.92,
  betterThanPercent: 30,
  groupSize: 24,
  step: 0.08,
  target: 2.02,
  basis: "חצי מהפער לרף הקבוצה",
  positionFit: "לכל העמדות",
  drills: [{ id: "d1", name: "ריצת האצה", why: "מאמן את הצעד הראשון", parameter: "מהירות ריצה" }],
};

function view(overrides: Partial<ProposalView>): ProposalView {
  return {
    id: "p1",
    traineeId: "t1",
    fullName: "נועה כהן",
    branchNames: ["קריית אתא"],
    assessmentDate: "2026-11-15",
    metricKey: "sprint_10m",
    label: "ספרינט 10 מטר",
    unit: "שניות",
    lowerIsBetter: true,
    rank: 1,
    baseline: 2.1,
    target: 2.02,
    facts: FACTS,
    reason: "הצעד הראשון הוא המקום שבו יש הכי הרבה מה להרוויח",
    problems: [],
    drills: [],
    version: "2026-11-17T04:15:42.123456+00:00",
    ...overrides,
  };
}

describe("targetLine", () => {
  it("names the baseline, the target and the unit", () => {
    expect(targetLine({ baseline: 2.1, target: 2.02, unit: "שניות" })).toBe("מ-2.1 ל-2.02 שניות");
    expect(targetLine({ baseline: 180, target: 188, unit: 'ס"מ' })).toBe('מ-180 ל-188 ס"מ');
  });

  it("never prints a float tail", () => {
    expect(targetLine({ baseline: 0.1 + 0.2, target: 2.0199999999999996, unit: "שניות" })).toBe("מ-0.3 ל-2.02 שניות");
  });
});

describe("standingLine", () => {
  it("names the group's bar and the share of the group the player is better than", () => {
    expect(standingLine(FACTS)).toBe("רף הקבוצה 1.92 שניות · טוב מ-30% מהקבוצה");
  });
});

describe("factsOf", () => {
  it("reads facts the job stored", () => {
    expect(factsOf(JSON.parse(JSON.stringify(FACTS)))).toEqual(FACTS);
  });

  it("refuses facts without a target", () => {
    const withoutTarget: Record<string, unknown> = { ...FACTS };
    delete withoutTarget.target;
    expect(factsOf(withoutTarget)).toBeNull();
  });

  it("refuses a metric that is not a Goal metric and a non-object", () => {
    expect(factsOf({ ...FACTS, metric_key: "kick_power_kaiser" })).toBeNull();
    expect(factsOf(null)).toBeNull();
    expect(factsOf("facts")).toBeNull();
    expect(factsOf([FACTS])).toBeNull();
  });

  it("refuses a drill without a name", () => {
    expect(factsOf({ ...FACTS, drills: [{ id: "d1", why: null, parameter: "מהירות" }] })).toBeNull();
  });
});

describe("the problems the card shows", () => {
  const sensitive = { code: "sensitive" as const, text: "כאב או פציעה" };
  const drill = { code: "drill" as const, text: "נבחר תרגיל שלא הוצע" };
  const number = { code: "number" as const, text: "מספר שלא מופיע בנתונים: 12" };

  it("lists each sensitive problem as a warning", () => {
    expect(sensitiveNotes([sensitive, number])).toEqual(["שימו לב: כאב או פציעה"]);
    expect(sensitiveNotes([number])).toEqual([]);
  });

  it("shows a repeated sensitive problem once", () => {
    const other = { code: "sensitive" as const, text: "דוח משמרת מ-3.11 מציין פציעות" };
    expect(sensitiveNotes([sensitive, other, sensitive])).toEqual([
      "שימו לב: כאב או פציעה",
      "שימו לב: דוח משמרת מ-3.11 מציין פציעות",
    ]);
  });

  it("says why the reason was dropped, from the first problem of the reason itself", () => {
    expect(droppedReasonLine([sensitive, drill, number])).toBe("הנימוק הוסר: מספר שלא מופיע בנתונים: 12");
    expect(droppedReasonLine([sensitive])).toBe("הנימוק הוסר");
  });
});

describe("groupByTrainee", () => {
  it("groups by Trainee, sorted by name, with the proposals by rank", () => {
    const groups = groupByTrainee([
      view({ id: "b2", traineeId: "t2", fullName: "בני לוי", rank: 2, metricKey: "jump_2leg_height" }),
      view({ id: "a1", traineeId: "t1", fullName: "אורי שמש", rank: 1 }),
      view({ id: "b1", traineeId: "t2", fullName: "בני לוי", rank: 1 }),
      view({ id: "b3", traineeId: "t2", fullName: "בני לוי", rank: 3, metricKey: "flexibility_hip" }),
    ]);
    expect(groups.map((group) => group.fullName)).toEqual(["אורי שמש", "בני לוי"]);
    expect(groups[1].proposals.map((proposal) => proposal.id)).toEqual(["b1", "b2", "b3"]);
    expect(groups[1]).toMatchObject({ traineeId: "t2", branchNames: ["קריית אתא"], assessmentDate: "2026-11-15" });
  });

  it("dates a group by its newest Assessment", () => {
    const [group] = groupByTrainee([
      view({ id: "x", assessmentDate: "2026-10-01", rank: 1 }),
      view({ id: "y", assessmentDate: "2026-11-15", rank: 2 }),
    ]);
    expect(group.assessmentDate).toBe("2026-11-15");
  });

  it("is empty for no proposals", () => {
    expect(groupByTrainee([])).toEqual([]);
  });
});
