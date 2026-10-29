import { describe, expect, test } from "vitest";
import type { AudienceCandidate } from "../audience";
import {
  branchIdsByProfile,
  surveyCounts,
  toCandidate,
  toOfferableSurvey,
  toQuestions,
  toReportResponses,
  toReportSeen,
  toSurveyRecord,
  type CandidateRow,
  type QuestionRow,
  type SurveyRow,
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
  const record = toSurveyRecord(surveyRow({ closes_on: "2026-11-01", intro: "שלום" }));

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

  test("a draft is never offered", () => {
    const draft = toSurveyRecord(surveyRow({ published_at: null }));

    expect(toOfferableSurvey(draft, [])).toBeNull();
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

describe("surveyCounts", () => {
  const kid = (
    profileId: string,
    branchIds: string[],
    over: Partial<AudienceCandidate> = {},
  ): AudienceCandidate => ({
    profileId,
    fullName: profileId,
    role: "trainee",
    isActive: true,
    deletedAt: null,
    birthdate: "2014-03-02",
    accessTier: "full",
    branchIds,
    ...over,
  });

  const candidates = [
    kid("c1", [KA]),
    kid("c2", [KA], { birthdate: "2015-05-05" }),
    kid("c3", [HA]),
    kid("c4", [HA], { isActive: false }),
    kid("c5", [KA, HA]),
  ];
  // c1 and c3 answered; "gone" answered from HA and has since left every branch.
  const responses = [
    { profileId: "c1", branchIds: [KA] },
    { profileId: "c3", branchIds: [HA] },
    { profileId: "gone", branchIds: [HA] },
  ];
  // c1 and c3 also saw it; c2, c4, c5 and "ghost" only saw it.
  const viewerIds = ["c1", "c2", "c3", "c4", "c5", "ghost"];
  const survey = { branchIds: [KA, HA], birthYears: [] as number[] };

  test("an Admin counts every branch of the Survey and every view", () => {
    const counts = surveyCounts({ survey, visibleBranchIds: null, candidates, responses, viewerIds });

    expect(counts).toEqual({ answered: 3, seen: 7, audience: 4 });
  });

  test("a manager counts Responses by their stored branches", () => {
    const counts = surveyCounts({ survey, visibleBranchIds: [HA], candidates, responses, viewerIds });

    // c3 and "gone" answered from HA; c4 and c5 only saw it from HA.
    expect(counts).toEqual({ answered: 2, seen: 4, audience: 2 });
  });

  test("a manager counts a viewer who only saw it by their current branches", () => {
    const counts = surveyCounts({ survey, visibleBranchIds: [KA], candidates, responses, viewerIds });

    // c1 answered from KA; c2 and c5 only saw it from KA; c4 and "ghost" are not in KA.
    expect(counts).toEqual({ answered: 1, seen: 3, audience: 3 });
  });

  test("a responder is placed by the stored branches, not the current ones", () => {
    const moved = [{ profileId: "c5", branchIds: [HA] }];

    const counts = surveyCounts({
      survey,
      visibleBranchIds: [KA],
      candidates,
      responses: moved,
      viewerIds: ["c5"],
    });

    expect(counts.answered).toBe(0);
    expect(counts.seen).toBe(0);
  });

  test("birth years narrow the audience and nothing else", () => {
    const only2014 = { branchIds: [KA, HA], birthYears: [2014] };

    const counts = surveyCounts({
      survey: only2014,
      visibleBranchIds: null,
      candidates,
      responses,
      viewerIds,
    });

    expect(counts).toEqual({ answered: 3, seen: 7, audience: 3 });
  });

  test("a Survey nobody touched is all zeros", () => {
    const counts = surveyCounts({
      survey,
      visibleBranchIds: null,
      candidates: [],
      responses: [],
      viewerIds: [],
    });

    expect(counts).toEqual({ answered: 0, seen: 0, audience: 0 });
  });
});
