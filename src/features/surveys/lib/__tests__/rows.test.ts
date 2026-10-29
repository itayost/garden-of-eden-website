import { describe, expect, test } from "vitest";
import { inSurveyAudience, birthYearOf, type AudienceCandidate } from "../audience";
import {
  buildSurveyReport,
  type ReportFilters,
  type ReportPerson,
} from "../report";
import {
  audienceReportPeople,
  branchIdsByProfile,
  groupBy,
  surveyListTotals,
  toCandidate,
  toOfferableSurvey,
  toQuestions,
  toReportResponses,
  toReportSeen,
  toSurveyRecord,
  type CandidateRow,
  type QuestionRow,
  type ResponseRow,
  type SurveyRow,
  type ViewRow,
} from "../rows";

const KA = "b-ka";
const HA = "b-ha";

const surveyRow = (over: Partial<SurveyRow> = {}): SurveyRow => ({
  id: "s1",
  title: "סקר קיץ",
  intro: null,
  opens_on: "2026-10-01",
  closes_on: null,
  birth_years: [2014, 2015],
  created_by: "staff1",
  created_at: "2026-09-30T08:00:00Z",
  updated_at: "2026-09-30T08:00:00Z",
  published_at: "2026-10-01T08:00:00Z",
  published_by: "staff1",
  closed_at: null,
  closed_by: null,
  survey_branches: [{ branch_id: KA }],
  ...over,
});

const questionRow = (over: Partial<QuestionRow> = {}): QuestionRow => ({
  id: "q1",
  position: 0,
  kind: "text",
  prompt: "מה לשנות?",
  required: false,
  low_label: null,
  high_label: null,
  survey_question_options: [],
  ...over,
});

describe("toSurveyRecord", () => {
  test("maps columns to the record and lists the branch ids in a stable order", () => {
    const record = toSurveyRecord(
      surveyRow({ survey_branches: [{ branch_id: "b-z" }, { branch_id: "b-a" }] }),
    );

    expect(record).toEqual({
      id: "s1",
      title: "סקר קיץ",
      intro: null,
      opensOn: "2026-10-01",
      closesOn: null,
      birthYears: [2014, 2015],
      branchIds: ["b-a", "b-z"],
      createdBy: "staff1",
      createdAt: "2026-09-30T08:00:00Z",
      publishedAt: "2026-10-01T08:00:00Z",
      closedAt: null,
    });
  });
});

describe("toQuestions", () => {
  test("orders Questions and options by position and renames prompt to text", () => {
    const rows = [
      questionRow({ id: "q2", position: 1, prompt: "שנייה" }),
      questionRow({
        id: "q1",
        position: 0,
        kind: "single_choice",
        prompt: "ראשונה",
        required: true,
        survey_question_options: [
          { id: "o2", position: 1, label: "ב" },
          { id: "o1", position: 0, label: "א" },
        ],
      }),
    ];

    const questions = toQuestions(rows);

    expect(questions.map((q) => q.id)).toEqual(["q1", "q2"]);
    expect(questions[0]).toEqual({
      id: "q1",
      kind: "single_choice",
      text: "ראשונה",
      required: true,
      lowLabel: null,
      highLabel: null,
      options: [
        { id: "o1", label: "א" },
        { id: "o2", label: "ב" },
      ],
    });
  });

  test("carries the rating end labels", () => {
    const [rating] = toQuestions([
      questionRow({ kind: "rating", low_label: "בכלל לא", high_label: "מאוד" }),
    ]);

    expect(rating?.lowLabel).toBe("בכלל לא");
    expect(rating?.highLabel).toBe("מאוד");
  });

  test("does not reorder the rows it is given", () => {
    const rows = [questionRow({ id: "q2", position: 1 }), questionRow({ id: "q1", position: 0 })];

    toQuestions(rows);

    expect(rows.map((r) => r.id)).toEqual(["q2", "q1"]);
  });

  test("refuses a Question kind it does not know", () => {
    expect(() => toQuestions([questionRow({ kind: "essay" })])).toThrow(/essay/);
  });
});

describe("toOfferableSurvey", () => {
  const record = {
    ...toSurveyRecord(surveyRow({ closes_on: "2026-11-01", intro: "שלום" })),
    publishedAt: "2026-10-01T08:00:00Z",
  };

  test("carries what the popup shows", () => {
    const questions = toQuestions([questionRow()]);

    expect(toOfferableSurvey(record, questions)).toEqual({
      id: "s1",
      title: "סקר קיץ",
      intro: "שלום",
      closesOn: "2026-11-01",
      publishedAt: "2026-10-01T08:00:00Z",
      questions,
    });
  });
});

describe("toCandidate", () => {
  const profile = (over: Partial<CandidateRow> = {}): CandidateRow => ({
    id: "p1",
    full_name: "יונתן לוי",
    role: "trainee",
    is_active: true,
    deleted_at: null,
    birthdate: "2014-03-02",
    arbox_paid_training: false,
    arbox_bought_course: false,
    access_override: null,
    ...over,
  });

  test("maps a trainee with every membership", () => {
    expect(toCandidate(profile(), [KA, HA])).toEqual({
      profileId: "p1",
      fullName: "יונתן לוי",
      role: "trainee",
      isActive: true,
      deletedAt: null,
      birthdate: "2014-03-02",
      accessTier: "full",
      branchIds: [KA, HA],
    });
  });

  test("a profile with no role is never a trainee", () => {
    expect(toCandidate(profile({ role: null }), [KA]).role).toBe("");
  });

  test("a profile with no name gets an empty one", () => {
    expect(toCandidate(profile({ full_name: null }), [KA]).fullName).toBe("");
  });

  test("a course buyer who never trained is course-only", () => {
    const row = profile({ arbox_bought_course: true, arbox_paid_training: false });

    expect(toCandidate(row, [KA]).accessTier).toBe("course_only");
  });

  test("an admin override wins over the Arbox facts", () => {
    const row = profile({ arbox_bought_course: true, access_override: "full" });

    expect(toCandidate(row, [KA]).accessTier).toBe("full");
  });
});

describe("branchIdsByProfile", () => {
  test("lists every branch of each profile", () => {
    const grouped = branchIdsByProfile([
      { profile_id: "p1", branch_id: KA },
      { profile_id: "p2", branch_id: HA },
      { profile_id: "p1", branch_id: HA },
    ]);

    expect(grouped.get("p1")).toEqual([KA, HA]);
    expect(grouped.get("p2")).toEqual([HA]);
    expect(grouped.get("p3")).toBeUndefined();
  });
});

describe("toReportResponses", () => {
  const responses = [
    { id: "r1", profile_id: "p1", submitted_at: "2026-10-05T10:00:00Z", branch_ids: [KA] },
    { id: "r2", profile_id: "p2", submitted_at: "2026-10-06T10:00:00Z", branch_ids: [HA] },
  ];
  const profiles = [{ id: "p1", full_name: "יונתן לוי", birthdate: "2014-03-02" }];
  const answers = [
    { response_id: "r1", question_id: "q1", option_id: null, rating: 4, text_value: null },
    { response_id: "r1", question_id: "q2", option_id: "o1", rating: null, text_value: null },
    { response_id: "r1", question_id: "q4", option_id: null, rating: null, text_value: "תודה" },
  ];

  test("a Response keeps its stored branches and the profile's current name and year", () => {
    const [first] = toReportResponses(responses, answers, profiles);

    expect(first).toMatchObject({
      profileId: "p1",
      fullName: "יונתן לוי",
      branchIds: [KA],
      birthYear: 2014,
      submittedAt: "2026-10-05T10:00:00Z",
    });
  });

  test("answers become answer rows under their own Response", () => {
    const [first, second] = toReportResponses(responses, answers, profiles);

    expect(first?.answers).toEqual([
      { questionId: "q1", optionId: null, rating: 4, text: null },
      { questionId: "q2", optionId: "o1", rating: null, text: null },
      { questionId: "q4", optionId: null, rating: null, text: "תודה" },
    ]);
    expect(second?.answers).toEqual([]);
  });

  test("a Response whose profile is missing keeps an empty name and no year", () => {
    const [, second] = toReportResponses(responses, answers, profiles);

    expect(second).toMatchObject({ profileId: "p2", fullName: "", birthYear: null });
  });
});

describe("toReportSeen", () => {
  test("maps view rows", () => {
    expect(toReportSeen([{ profile_id: "p1", first_seen_at: "2026-10-04T09:00:00Z" }])).toEqual([
      { profileId: "p1", firstSeenAt: "2026-10-04T09:00:00Z" },
    ]);
  });
});

describe("groupBy", () => {
  test("groups items under their key and keeps their order", () => {
    const grouped = groupBy(
      [
        { survey: "s1", n: 1 },
        { survey: "s2", n: 2 },
        { survey: "s1", n: 3 },
      ],
      (item) => item.survey,
    );

    expect(grouped.get("s1")?.map((item) => item.n)).toEqual([1, 3]);
    expect(grouped.get("s2")?.map((item) => item.n)).toEqual([2]);
    expect(grouped.get("s3")).toBeUndefined();
  });

  test("nothing in, nothing out", () => {
    expect(groupBy([], (item: string) => item).size).toBe(0);
  });
});

describe("surveyListTotals", () => {
  const kid = (
    profileId: string,
    branchIds: string[],
    over: Partial<AudienceCandidate> = {},
  ): AudienceCandidate => ({
    profileId,
    fullName: `name-${profileId}`,
    role: "trainee",
    isActive: true,
    deletedAt: null,
    birthdate: "2014-03-02",
    accessTier: "full",
    branchIds,
    ...over,
  });

  // c1, c3 and "mover" answered; "gone" answered and has since been deactivated.
  // c2, c4 (inactive) and c5 only saw it; c6 never did; "ghost" saw it and belongs to no branch.
  const candidates = [
    kid("c1", [KA]),
    kid("c2", [KA], { birthdate: "2015-05-05" }),
    kid("c3", [HA]),
    kid("c4", [HA], { isActive: false }),
    kid("c5", [KA, HA]),
    kid("c6", [HA]),
    kid("mover", [HA]),
    kid("gone", [HA], { isActive: false }),
  ];
  const response = (id: string, profileId: string, branchIds: string[]): ResponseRow => ({
    id,
    profile_id: profileId,
    submitted_at: "2026-10-05T10:00:00Z",
    branch_ids: branchIds,
  });
  // "mover" answered from KA and has since moved to HA.
  const responses = [
    response("r1", "c1", [KA]),
    response("r3", "c3", [HA]),
    response("rm", "mover", [KA]),
    response("rg", "gone", [HA]),
  ];
  const view = (profileId: string): ViewRow => ({
    profile_id: profileId,
    first_seen_at: "2026-10-04T09:00:00Z",
  });
  const views = ["c1", "c2", "c3", "c4", "c5", "mover", "gone", "ghost"].map(view);
  const survey = { branchIds: [KA, HA], birthYears: [] as number[] };

  const defaultFilters: ReportFilters = {
    branchId: null,
    birthYear: null,
    segment: "answered",
    search: "",
    page: 1,
  };

  /** The results page's own totals, built the way its page builds them. */
  function reportTotals(
    target: { branchIds: string[]; birthYears: number[] },
    visibleBranchIds: string[] | null,
  ) {
    const audience: ReportPerson[] = candidates
      .filter((c) => inSurveyAudience(c, target))
      .map((c) => ({
        profileId: c.profileId,
        fullName: c.fullName,
        branchIds: c.branchIds,
        birthYear: birthYearOf(c.birthdate),
      }));
    return buildSurveyReport({
      questions: [],
      branches: [
        { id: KA, name: "קריית אתא" },
        { id: HA, name: "חיפה" },
      ],
      responses: toReportResponses(responses, [], []),
      seen: toReportSeen(views),
      audience,
      visibleBranchIds,
      filters: defaultFilters,
    }).totals;
  }

  const listTotals = (target: typeof survey, visibleBranchIds: string[] | null) =>
    surveyListTotals({ survey: target, visibleBranchIds, candidates, responses, views });

  test.each([
    ["an Admin", null],
    ["a manager of Kiryat Ata", [KA]],
    ["a manager of Haifa", [HA]],
    ["a manager of both", [KA, HA]],
  ])("the list counts equal the results page totals for %s", (_who, visibleBranchIds) => {
    expect(listTotals(survey, visibleBranchIds)).toEqual(reportTotals(survey, visibleBranchIds));
  });

  test("the list counts equal the results page totals when birth years narrow the Audience", () => {
    const only2014 = { branchIds: [KA, HA], birthYears: [2014] };

    expect(listTotals(only2014, null)).toEqual(reportTotals(only2014, null));
    expect(listTotals(only2014, [KA])).toEqual(reportTotals(only2014, [KA]));
  });

  test("an Admin counts the Audience and every responder once, and no one outside both", () => {
    // Audience: c1, c2, c3, c5, c6, mover. Plus "gone", who answered and left it.
    // Not counted: c4 (inactive viewer) and "ghost" (a viewer in no branch).
    expect(listTotals(survey, null)).toEqual({ audience: 7, seen: 6, answered: 4, ratePct: 67 });
  });

  test("a manager places a responder by the branch they answered from", () => {
    // c1 and "mover" (now in Haifa) answered from Kiryat Ata; c2 and c5 only saw it from there.
    expect(listTotals(survey, [KA])).toEqual({ audience: 4, seen: 4, answered: 2, ratePct: 50 });
  });

  test("a Survey nobody touched is all zeros", () => {
    const totals = surveyListTotals({
      survey,
      visibleBranchIds: null,
      candidates: [],
      responses: [],
      views: [],
    });

    expect(totals).toEqual({ audience: 0, seen: 0, answered: 0, ratePct: 0 });
  });
});


describe("audienceReportPeople", () => {
  const candidate = (profileId: string, over: Partial<AudienceCandidate> = {}): AudienceCandidate => ({
    profileId,
    fullName: `name-${profileId}`,
    role: "trainee",
    isActive: true,
    deletedAt: null,
    birthdate: "2014-03-02",
    accessTier: "full",
    branchIds: [KA],
    ...over,
  });

  test("keeps only the Trainees the Survey is for, as report people with their birth year", () => {
    const people = audienceReportPeople(
      [
        candidate("in", { branchIds: [KA, HA] }),
        candidate("other-year", { birthdate: "2012-01-01" }),
        candidate("other-branch", { branchIds: [HA] }),
        candidate("inactive", { isActive: false }),
        candidate("no-birthdate", { birthdate: null }),
      ],
      { branchIds: [KA], birthYears: [2014] },
    );

    expect(people).toEqual([
      { profileId: "in", fullName: "name-in", branchIds: [KA, HA], birthYear: 2014 },
    ]);
  });

  test("no birth years named means every year, with or without a birthdate", () => {
    const people = audienceReportPeople(
      [candidate("a"), candidate("b", { birthdate: null })],
      { branchIds: [KA], birthYears: [] },
    );

    expect(people.map((p) => [p.profileId, p.birthYear])).toEqual([
      ["a", 2014],
      ["b", null],
    ]);
  });
});
