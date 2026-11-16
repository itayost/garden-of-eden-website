import { describe, expect, it } from "vitest";
import {
  countsLine,
  hasNewData,
  parentOutcome,
  pickTab,
  pickWeek,
  QUEUE_TABS,
  queueHref,
  statusLabel,
  tabCounts,
  tabOf,
  weekChoices,
  wordCount,
} from "../queue-view";

const EMPTY = { held: 0, pending: 0, approved: 0, sent: 0, missed_you: 0, absent: 0 };

describe("tabOf", () => {
  it("puts a report in the tab of its status, sent and not sent together", () => {
    expect(tabOf("report", "held")).toBe("held");
    expect(tabOf("report", "pending")).toBe("pending");
    expect(tabOf("report", "approved")).toBe("approved");
    expect(tabOf("report", "sent")).toBe("sent");
    expect(tabOf("report", "not_sent")).toBe("sent");
  });

  it("gives התגעגענו and the absent list their own tabs whatever the status", () => {
    expect(tabOf("missed_you", "approved")).toBe("missed_you");
    expect(tabOf("missed_you", "held")).toBe("missed_you");
    expect(tabOf("missed_you", "sent")).toBe("missed_you");
    expect(tabOf("absent", "listed")).toBe("absent");
  });

  it("gives no tab to an unknown kind or status", () => {
    expect(tabOf("report", "listed")).toBeNull();
    expect(tabOf("other", "pending")).toBeNull();
  });
});

describe("the tabs", () => {
  it("run held first, then pending, approved, sent, missed you and absent", () => {
    expect(QUEUE_TABS.map((t) => t.tab)).toEqual(["held", "pending", "approved", "sent", "missed_you", "absent"]);
    expect(QUEUE_TABS.map((t) => t.label)).toEqual([
      "מעוכבים",
      "ממתינים לאישור",
      "אושרו",
      "נשלחו",
      "התגעגענו",
      "לא הגיעו 3 שבועות",
    ]);
  });

  it("count each tab", () => {
    expect(tabCounts(["held", "pending", "pending", "absent"])).toEqual({ ...EMPTY, held: 1, pending: 2, absent: 1 });
  });

  it("take the requested tab, else the first with rows, else held", () => {
    const counts = { ...EMPTY, approved: 2, sent: 4 };
    expect(pickTab("sent", counts)).toBe("sent");
    expect(pickTab("missed_you", counts)).toBe("missed_you");
    expect(pickTab(undefined, counts)).toBe("approved");
    expect(pickTab("nonsense", counts)).toBe("approved");
    expect(pickTab(undefined, EMPTY)).toBe("held");
  });
});

describe("countsLine", () => {
  it("names what waits, what is held, approved and sent, leaving out zeros", () => {
    expect(countsLine({ ...EMPTY, pending: 12, held: 3, sent: 40, missed_you: 5 })).toBe(
      "12 ממתינים · 3 מעוכבים · 40 נשלחו",
    );
  });

  it("uses the singular for one", () => {
    expect(countsLine({ ...EMPTY, pending: 1, held: 1, approved: 1, sent: 1 })).toBe(
      "1 ממתין · 1 מעוכב · 1 אושר · 1 נשלח",
    );
  });

  it("says so when the week has no report", () => {
    expect(countsLine({ ...EMPTY, absent: 2 })).toBe("אין דוחות בשבוע הזה");
  });
});

describe("statusLabel", () => {
  it("gives the Hebrew chip of each status", () => {
    expect(statusLabel("pending")).toBe("ממתין לאישור");
    expect(statusLabel("held")).toBe("מעוכב");
    expect(statusLabel("approved")).toBe("אושר");
    expect(statusLabel("sent")).toBe("נשלח");
    expect(statusLabel("not_sent")).toBe("לא נשלח");
    expect(statusLabel("listed")).toBe("לא הגיע 3 שבועות");
    expect(statusLabel("strange")).toBe("strange");
  });
});

describe("parentOutcome", () => {
  it("says the parent got it when there is a message id", () => {
    expect(parentOutcome({ status: "sent", parentMessageId: "wamid.1", parentSkipReason: null })).toBe("נשלח להורה");
  });

  it("gives the skip label otherwise", () => {
    expect(parentOutcome({ status: "sent", parentMessageId: null, parentSkipReason: "no_phone" })).toBe(
      "אין טלפון של הורה",
    );
    expect(
      parentOutcome({ status: "sent", parentMessageId: null, parentSkipReason: "whatsapp_failed: (#131000) error" }),
    ).toBe("השליחה בוואטסאפ נכשלה");
  });

  it("is nothing before the row was sent, or with nothing recorded", () => {
    expect(parentOutcome({ status: "approved", parentMessageId: null, parentSkipReason: null })).toBeNull();
    expect(parentOutcome({ status: "sent", parentMessageId: null, parentSkipReason: null })).toBeNull();
  });
});

describe("hasNewData", () => {
  const written = "2026-11-20T01:10:00.000+00:00";

  it("is true for an entry after the text was written", () => {
    expect(hasNewData(written, ["2026-11-19T18:00:00+00:00", "2026-11-20T07:30:00.5+00:00"])).toBe(true);
  });

  it("compares instants, not strings", () => {
    expect(hasNewData(written, ["2026-11-20T03:11:00+02:00"])).toBe(true);
    expect(hasNewData(written, ["2026-11-20T03:09:00+02:00"])).toBe(false);
  });

  it("is false with nothing after, and for a text not written yet", () => {
    expect(hasNewData(written, ["2026-11-19T18:00:00+00:00"])).toBe(false);
    expect(hasNewData(written, [])).toBe(false);
    expect(hasNewData(null, ["2026-11-20T07:30:00+00:00"])).toBe(false);
  });
});

describe("wordCount", () => {
  it("counts words split by any whitespace", () => {
    expect(wordCount("  שלום   {שם},\nאיזה שבוע  ")).toBe(4);
    expect(wordCount("   ")).toBe(0);
  });
});

describe("weeks", () => {
  it("lists the stored weeks with the current one, newest first, once each", () => {
    expect(weekChoices(["2026-11-06", "2026-11-13"], "2026-11-13")).toEqual(["2026-11-13", "2026-11-06"]);
    expect(weekChoices(["2026-11-06"], "2026-11-13")).toEqual(["2026-11-13", "2026-11-06"]);
  });

  it("takes a requested Friday, else the current week", () => {
    expect(pickWeek("2026-11-06", "2026-11-13")).toBe("2026-11-06");
    expect(pickWeek("2026-11-07", "2026-11-13")).toBe("2026-11-13");
    expect(pickWeek("2026-02-30", "2026-11-13")).toBe("2026-11-13");
    expect(pickWeek(undefined, "2026-11-13")).toBe("2026-11-13");
  });
});

describe("queueHref", () => {
  it("keeps the week, the branch, the tab and the open report in the URL", () => {
    expect(queueHref({ week: "2026-11-13", branch: "b1", tab: "held", report: "r1" })).toBe(
      "/admin/weekly-reports?week=2026-11-13&branch=b1&tab=held&report=r1",
    );
    expect(queueHref({ week: "2026-11-13" })).toBe("/admin/weekly-reports?week=2026-11-13");
  });
});
