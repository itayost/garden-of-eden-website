import { describe, expect, it } from "vitest";
import {
  countsLine,
  filterCount,
  filterRows,
  nextReportId,
  pickFilter,
  textPreview,
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

const EMPTY = { held: 0, pending: 0, approved: 0, sent: 0, missed_you: 0, absent: 0, proposals: 0 };

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

  it("never puts a report in the Goal proposals tab", () => {
    expect(tabOf("proposals", "proposed")).toBeNull();
    expect(tabOf("report", "proposals")).toBeNull();
    expect(tabOf("report", "proposed")).toBeNull();
  });
});

describe("the tabs", () => {
  it("run held first, then pending, approved, sent, missed you, absent and the Goal proposals last", () => {
    expect(QUEUE_TABS.map((t) => t.tab)).toEqual([
      "held",
      "pending",
      "approved",
      "sent",
      "missed_you",
      "absent",
      "proposals",
    ]);
    expect(QUEUE_TABS.map((t) => t.label)).toEqual([
      "מעוכבים",
      "ממתינים לאישור",
      "אושרו",
      "נשלחו",
      "התגעגענו",
      "לא הגיעו 3 שבועות",
      "הצעות יעד",
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

  it("take the Goal proposals tab when asked, or when only it has rows", () => {
    expect(pickTab("proposals", { ...EMPTY, pending: 3 })).toBe("proposals");
    expect(pickTab("proposals", EMPTY)).toBe("proposals");
    expect(pickTab(undefined, { ...EMPTY, proposals: 2 })).toBe("proposals");
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

  it("leaves the Goal proposals out: they are not reports", () => {
    expect(countsLine({ ...EMPTY, proposals: 4 })).toBe("אין דוחות בשבוע הזה");
    expect(countsLine({ ...EMPTY, pending: 2, proposals: 4 })).toBe("2 ממתינים");
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
    expect(queueHref({ week: "2026-11-13", branch: "b1", tab: "todo", report: "r1" })).toBe(
      "/admin/weekly-reports?week=2026-11-13&branch=b1&tab=todo&report=r1",
    );
    expect(queueHref({ week: "2026-11-13" })).toBe("/admin/weekly-reports?week=2026-11-13");
  });
});

describe("the filters", () => {
  const counts = { ...EMPTY, held: 2, pending: 14, approved: 9, missed_you: 3 };

  it("לטיפול counts the held and the pending together", () => {
    expect(filterCount("todo", counts)).toBe(16);
    expect(filterCount("approved", counts)).toBe(9);
  });

  it("an old held or pending link opens לטיפול", () => {
    expect(pickFilter("held", counts)).toBe("todo");
    expect(pickFilter("pending", counts)).toBe("todo");
    expect(pickFilter("missed_you", counts)).toBe("missed_you");
  });

  it("with no filter asked for, the first that has rows, else לטיפול", () => {
    expect(pickFilter(undefined, { ...EMPTY, approved: 4 })).toBe("approved");
    expect(pickFilter("nonsense", EMPTY)).toBe("todo");
  });

  it("לטיפול lists the held first, each group in its own order", () => {
    const rows = [
      { id: "a", tab: "pending" as const },
      { id: "b", tab: "held" as const },
      { id: "c", tab: "approved" as const },
      { id: "d", tab: "pending" as const },
      { id: "e", tab: "held" as const },
    ];
    expect(filterRows(rows, "todo").map((r) => r.id)).toEqual(["b", "e", "a", "d"]);
    expect(filterRows(rows, "approved").map((r) => r.id)).toEqual(["c"]);
  });
});

describe("nextReportId", () => {
  const rows = [{ id: "a" }, { id: "b" }, { id: "c" }];

  it("is the row after the open one", () => {
    expect(nextReportId(rows, "a")).toBe("b");
  });

  it("is none after the last", () => {
    expect(nextReportId(rows, "c")).toBeNull();
  });

  it("is the first row when the open one is not in the list", () => {
    expect(nextReportId(rows, "z")).toBe("a");
    expect(nextReportId([], "z")).toBeNull();
  });
});

describe("textPreview", () => {
  it("fills in the name and keeps the start of the text", () => {
    expect(textPreview("{שם}, שבוע חזק.\n\nהגעת לשני אימונים.", "עומר")).toBe("עומר, שבוע חזק. הגעת לשני אימונים.");
  });

  it("cuts a long text at a word and marks the cut", () => {
    const preview = textPreview(`${"מילה ".repeat(40)}סוף`, "עומר");
    expect(preview?.endsWith("…")).toBe(true);
    expect(preview?.length).toBeLessThanOrEqual(91);
    expect(preview).not.toMatch(/מיל…$/);
  });

  it("is none for a text not written yet", () => {
    expect(textPreview(null, "עומר")).toBeNull();
    expect(textPreview("  ", "עומר")).toBeNull();
  });
});
