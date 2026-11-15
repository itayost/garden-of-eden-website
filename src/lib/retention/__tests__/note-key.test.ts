import { describe, expect, it } from "vitest";
import { normalizePhoneIL } from "@/lib/validations/common";
import type { RetentionEntry, RetentionReportData } from "@/lib/arbox/retention";
import { retentionProfileMatcher } from "@/lib/arbox/retention-branches";
import { endingReportLink, planNoteCarryOver, reportMonthOf, retentionNoteKey } from "../note-key";

const entry = (overrides: Partial<RetentionEntry>): RetentionEntry => ({
  user_id: null,
  name: "שחקן",
  phone: null,
  end_date: "2026-12-23",
  membership_type_name: "כרטיסיה 10 אימונים",
  attendance: [null, null, null, null],
  ...overrides,
});

const report = (training_card: RetentionEntry[]): RetentionReportData => ({ monthly: [], pro: [], training_card });

const profiles = [
  { id: "trainee-a", phone: normalizePhoneIL("0507654321"), arboxUserId: 5550001 },
  { id: "trainee-b", phone: normalizePhoneIL("0521234567"), arboxUserId: 5550002 },
];
const match = retentionProfileMatcher(profiles);
const matchId = (e: RetentionEntry) => match(e)?.id;

const row = { profileId: "trainee-a", endsOn: "2026-12-23", traineeName: "שחקן בסניף", ownPhone: "+972507654321" };

describe("retentionNoteKey", () => {
  it("keys a row by its phone as stored", () => {
    expect(retentionNoteKey({ phone: "0521234567", name: "שחקן" })).toBe("0521234567");
  });

  it("keys a row with no phone by its trimmed lower-case name", () => {
    expect(retentionNoteKey({ phone: null, name: "  Noa Levi " })).toBe("no-phone:noa levi");
  });
});

describe("reportMonthOf", () => {
  it("is the first day of the date's month", () => {
    expect(reportMonthOf("2026-12-23")).toBe("2026-12-01");
  });
});

describe("endingReportLink", () => {
  it("uses the phone Arbox lists the trainee under in the month the plan ends", () => {
    const listed = report([entry({ user_id: 5550001, phone: "0529999999" })]);
    expect(endingReportLink(row, listed, matchId).noteKey).toEqual({ reportMonth: "2026-12-01", phone: "0529999999" });
  });

  it("uses the trainee's own phone when the month's report does not list them", () => {
    const other = report([entry({ user_id: 5550002, phone: "0521234567" })]);
    expect(endingReportLink(row, other, matchId).noteKey).toEqual({ reportMonth: "2026-12-01", phone: "+972507654321" });
  });

  it("uses the trainee's own phone when no report is stored for that month", () => {
    expect(endingReportLink(row, null, matchId).noteKey.phone).toBe("+972507654321");
  });

  it("does not take a row Arbox matches to another trainee, even on the trainee's own phone", () => {
    const sibling = report([entry({ user_id: 5550002, phone: "0507654321" })]);
    expect(endingReportLink(row, sibling, matchId).noteKey.phone).toBe("+972507654321");
  });

  it("falls back to the name key with no phone at all", () => {
    expect(endingReportLink({ ...row, ownPhone: null }, null, matchId).noteKey.phone).toBe("no-phone:שחקן בסניף");
  });

  it("moves to לקוחות שעזבו under the report row's name and end date, so both tabs see one move", () => {
    const listed = report([entry({ user_id: 5550001, name: "שחקן מארבוקס", end_date: "2026-12-20" })]);
    expect(endingReportLink(row, listed, matchId).moveAs).toEqual({ name: "שחקן מארבוקס", endDate: "2026-12-20" });
    expect(endingReportLink(row, null, matchId).moveAs).toEqual({ name: "שחקן בסניף", endDate: "2026-12-23" });
  });
});

describe("planNoteCarryOver", () => {
  const ownPhone = new Map([
    ["trainee-a", "+972507654321"],
    ["trainee-b", "+972521234567"],
  ]);
  const ownPhoneOf = (id: string) => ownPhone.get(id) ?? null;

  it("moves a note saved under the trainee's own phone to the phone the report now lists them under", () => {
    const listed = report([entry({ user_id: 5550001, phone: "0529999999" })]);
    expect(planNoteCarryOver(listed, ownPhoneOf, matchId, new Set(["+972507654321"]))).toEqual([
      { from: "+972507654321", to: "0529999999" },
    ]);
  });

  it("leaves it when the row's phone already has a note", () => {
    const listed = report([entry({ user_id: 5550001, phone: "0529999999" })]);
    expect(planNoteCarryOver(listed, ownPhoneOf, matchId, new Set(["+972507654321", "0529999999"]))).toEqual([]);
  });

  it("leaves it when another row of the report is keyed by that phone", () => {
    const listed = report([
      entry({ user_id: 5550001, phone: "0529999999" }),
      entry({ user_id: null, name: "אחר", phone: "+972507654321" }),
    ]);
    expect(planNoteCarryOver(listed, ownPhoneOf, matchId, new Set(["+972507654321"]))).toEqual([]);
  });

  it("does nothing when the report lists the trainee under their own phone", () => {
    const listed = report([entry({ user_id: 5550001, phone: "+972507654321" })]);
    expect(planNoteCarryOver(listed, ownPhoneOf, matchId, new Set(["+972507654321"]))).toEqual([]);
  });

  it("moves only one note into a phone two trainees are listed under", () => {
    const listed = report([
      entry({ user_id: 5550001, phone: "0529999999" }),
      entry({ user_id: 5550002, phone: "0529999999" }),
    ]);
    expect(planNoteCarryOver(listed, ownPhoneOf, matchId, new Set(["+972507654321", "+972521234567"]))).toHaveLength(1);
  });
});
