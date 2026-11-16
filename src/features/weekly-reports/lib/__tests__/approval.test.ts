import { describe, expect, test } from "vitest";
import { approveRefusal } from "../approval";
import type { HoldReason } from "../fact-sheet/types";

type ReportForApproval = Parameters<typeof approveRefusal>[0];

const report = (overrides: Partial<ReportForApproval> = {}): ReportForApproval => ({
  kind: "report",
  status: "pending",
  playerText: "{שם} השקיע השבוע",
  parentText: "{שם} השקיע השבוע",
  holdReasons: [],
  ...overrides,
});

const sensitive: HoldReason = { code: "sensitive", text: "תגית כאב או פציעה מ-17/11" };
const number: HoldReason = { code: "number", text: "מספר שלא מופיע בנתונים: 12" };
const length: HoldReason = { code: "length", text: "הטקסט להורה ריק" };

describe("approveRefusal", () => {
  test("a pending report with clean texts may be approved", () => {
    expect(approveRefusal(report())).toBeNull();
  });

  test("a report held only for a person may be approved: opening it is the review", () => {
    expect(approveRefusal(report({ status: "held", holdReasons: [sensitive] }))).toBeNull();
    expect(approveRefusal(report({ status: "held", holdReasons: [{ code: "manual", text: "עוכב" }] }))).toBeNull();
  });

  test("a text problem refuses with its text", () => {
    expect(approveRefusal(report({ status: "held", holdReasons: [sensitive, number] }))).toBe(
      "צריך לתקן לפני אישור: מספר שלא מופיע בנתונים: 12",
    );
  });

  test("several text problems are joined", () => {
    expect(approveRefusal(report({ status: "held", holdReasons: [number, length] }))).toBe(
      "צריך לתקן לפני אישור: מספר שלא מופיע בנתונים: 12 · הטקסט להורה ריק",
    );
  });

  test("a sent report", () => expect(approveRefusal(report({ status: "sent" }))).toBe("הדוח כבר נשלח"));
  test("a closed week", () => expect(approveRefusal(report({ status: "not_sent" }))).toBe("השבוע של הדוח נסגר"));
  test("an approved report", () => expect(approveRefusal(report({ status: "approved" }))).toBe("הדוח כבר אושר"));

  test("an absent row has nothing to approve", () => {
    expect(approveRefusal(report({ kind: "absent", status: "listed" }))).toBe("אין מה לאשר בשורה הזו");
  });

  test("a report with no texts yet", () => {
    expect(approveRefusal(report({ playerText: null, parentText: null }))).toBe("אין עדיין טקסט לאישור");
    expect(approveRefusal(report({ parentText: "  " }))).toBe("אין עדיין טקסט לאישור");
  });
});
