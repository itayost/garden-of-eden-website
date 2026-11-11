import { describe, expect, it } from "vitest";
import type { RetentionEntry, RetentionReportData } from "@/lib/arbox/retention";
import type { RetentionViewData, RetentionViewEntry } from "@/lib/arbox/retention-branches";
import {
  arboxUserIdsForPhone,
  inRetentionScope,
  mayWriteRetentionPhone,
  scopeRetentionNotes,
  scopeRetentionView,
  traineesListedUnder,
  type RetentionScope,
  type TraineeIndex,
} from "../visibility";

const viewEntry = (overrides: Partial<RetentionViewEntry>): RetentionViewEntry => ({
  user_id: null,
  name: "שחקן",
  phone: null,
  end_date: "2026-12-23",
  membership_type_name: "כרטיסייה",
  attendance: [null, null, null, null],
  branch_attendance: { haifa: [null, null, null, null], kiryat: [null, null, null, null] },
  source: "arbox",
  profile_id: null,
  ...overrides,
});

const arboxEntry = (overrides: Partial<RetentionEntry>): RetentionEntry => ({
  user_id: null,
  name: "שחקן",
  phone: null,
  end_date: "2026-12-23",
  membership_type_name: "כרטיסייה",
  attendance: [null, null, null, null],
  ...overrides,
});

// A trainer whose branches hold one trainee, profile "in", phone 050-765-4321.
const scope: RetentionScope = {
  profileIds: new Set(["in"]),
  phones: new Set(["+972507654321"]),
};

describe("inRetentionScope", () => {
  it("keeps a row whose matched trainee is in scope though Arbox lists another phone (#172)", () => {
    expect(inRetentionScope(viewEntry({ profile_id: "in", phone: "0521234567" }), scope)).toBe(true);
  });

  it("keeps a row whose phone is a trainee's phone in scope", () => {
    expect(inRetentionScope(viewEntry({ phone: "050-765-4321" }), scope)).toBe(true);
  });

  it("drops a row whose trainee and phone are both outside scope", () => {
    expect(inRetentionScope(viewEntry({ profile_id: "out", phone: "0521111111" }), scope)).toBe(false);
  });

  it("drops a row matched to a trainee outside scope even when its phone is a phone in scope", () => {
    expect(inRetentionScope(viewEntry({ profile_id: "out", phone: "050-765-4321" }), scope)).toBe(false);
  });

  it("drops a row that matched no trainee and has no phone in scope", () => {
    expect(inRetentionScope(viewEntry({ phone: "0521111111" }), scope)).toBe(false);
    expect(inRetentionScope(viewEntry({}), scope)).toBe(false);
  });
});

describe("scopeRetentionView", () => {
  const view: RetentionViewData = {
    monthly: [viewEntry({ profile_id: "out", phone: "0521111111" })],
    pro: [],
    training_card: [viewEntry({ profile_id: "in", phone: "0521234567", name: "שחקן בסניף" })],
  };

  it("keeps only the rows in the caller's scope, in every tab", () => {
    const scoped = scopeRetentionView(view, scope);
    expect(scoped.monthly).toEqual([]);
    expect(scoped.training_card.map((e) => e.name)).toEqual(["שחקן בסניף"]);
  });

  it("leaves the report whole for a caller with no branch restriction", () => {
    expect(scopeRetentionView(view, null)).toBe(view);
  });
});

describe("arboxUserIdsForPhone", () => {
  const report: RetentionReportData = {
    monthly: [arboxEntry({ user_id: 11, phone: "052-123-4567" })],
    pro: [arboxEntry({ user_id: 12, phone: "0521111111" })],
    training_card: [
      arboxEntry({ user_id: 5550001, phone: "0521234567" }),
      arboxEntry({ phone: "0521234567" }),
    ],
  };

  it("finds the Arbox users a report lists under a phone, whatever its format", () => {
    expect(arboxUserIdsForPhone(report, "+972521234567")).toEqual([11, 5550001]);
  });

  it("finds nothing for a phone the report does not list", () => {
    expect(arboxUserIdsForPhone(report, "+972509999999")).toEqual([]);
    expect(arboxUserIdsForPhone(report, "not a phone")).toEqual([]);
  });

  it("matches a phone it cannot normalize, such as a landline, by its exact text", () => {
    const landline: RetentionReportData = {
      monthly: [arboxEntry({ user_id: 21, phone: "04-8123456" }), arboxEntry({ user_id: 22, phone: "04-8999999" })],
      pro: [],
      training_card: [],
    };
    expect(arboxUserIdsForPhone(landline, " 04-8123456 ")).toEqual([21]);
  });
});

describe("traineesListedUnder", () => {
  const october: RetentionReportData = {
    monthly: [arboxEntry({ user_id: 31, phone: "0521234567" })],
    pro: [],
    training_card: [],
  };
  const november: RetentionReportData = {
    monthly: [],
    pro: [],
    training_card: [arboxEntry({ user_id: 32, phone: "052-123-4567" }), arboxEntry({ user_id: 99, phone: "0521234567" })],
  };
  const index: TraineeIndex = {
    byArboxId: new Map([
      [31, "t31"],
      [32, "t32"],
    ]),
    byPhone: new Map([
      ["+972521234567", "t31"],
      ["+972507654321", "own"],
    ]),
  };

  it("finds the trainees Arbox lists under the phone in any of the given months", () => {
    expect(traineesListedUnder([october, november], "+972521234567", index)).toEqual(["t31", "t32"]);
  });

  it("finds the trainee whose own phone it is, with no Arbox row", () => {
    expect(traineesListedUnder([october], "050-765-4321", index)).toEqual(["own"]);
  });

  it("finds nobody for a phone no trainee has and no row lists", () => {
    expect(traineesListedUnder([october, november], "0521111111", index)).toEqual([]);
  });
});

describe("scopeRetentionNotes", () => {
  const notes = new Map([
    ["0521234567", "Arbox phone of a trainee in scope"],
    ["0527777777", "sibling outside the branch"],
    ["+972507654321", "own phone, no Arbox row"],
    ["0521111111", "somebody else"],
  ]);
  const listed: Record<string, readonly string[]> = {
    "0521234567": ["in"],
    "0527777777": ["out"],
  };

  it("returns only the notes the caller could also write", () => {
    const scoped = scopeRetentionNotes(notes, (phone) => listed[phone] ?? [], scope);
    expect([...scoped.values()]).toEqual(["Arbox phone of a trainee in scope", "own phone, no Arbox row"]);
  });

  it("returns every note to a caller with no branch restriction", () => {
    expect(scopeRetentionNotes(notes, () => [], null)).toBe(notes);
  });
});

describe("mayWriteRetentionPhone", () => {
  it("allows a phone that Arbox lists under a trainee in scope, though it is not their own phone", () => {
    expect(mayWriteRetentionPhone("0521234567", ["in"], scope)).toBe(true);
  });

  it("refuses a phone that is also listed under a trainee outside scope", () => {
    expect(mayWriteRetentionPhone("0521234567", ["in", "out"], scope)).toBe(false);
    expect(mayWriteRetentionPhone("050-765-4321", ["out"], scope)).toBe(false);
  });

  it("allows a trainee's own phone in scope when no Arbox row lists it", () => {
    expect(mayWriteRetentionPhone("050-765-4321", [], scope)).toBe(true);
  });

  it("refuses a phone nobody in scope is listed under or owns", () => {
    expect(mayWriteRetentionPhone("0521111111", [], scope)).toBe(false);
  });
});
