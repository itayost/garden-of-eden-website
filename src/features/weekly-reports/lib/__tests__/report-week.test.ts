import { describe, expect, test } from "vitest";
import { getIsraelTime } from "@/lib/utils/israel-time";
import {
  isSendWindow,
  nextSendLabel,
  lastCompletedWeekStart,
  reportWeekDays,
  reportWeekEnd,
  reportWeekLabel,
  reportWeekStart,
  weekdayOf,
  weeksBetween,
  writePhase,
} from "../report-week";

const at = (iso: string) => getIsraelTime(new Date(iso));

describe("weekdayOf", () => {
  test("reads the weekday from the date alone", () => {
    expect(weekdayOf("2026-11-15")).toBe(0);
    expect(weekdayOf("2026-11-19")).toBe(4);
    expect(weekdayOf("2026-11-20")).toBe(5);
    expect(weekdayOf("2026-11-21")).toBe(6);
  });
});

describe("reportWeekStart", () => {
  test("a Friday starts its own week", () => {
    expect(reportWeekStart("2026-11-20")).toBe("2026-11-20");
  });

  test("a Thursday belongs to the week that started the Friday before", () => {
    expect(reportWeekStart("2026-11-19")).toBe("2026-11-13");
  });

  test("a Saturday belongs to the week that started the day before", () => {
    expect(reportWeekStart("2026-11-21")).toBe("2026-11-20");
  });

  test("crosses a month and a year", () => {
    expect(reportWeekStart("2027-01-02")).toBe("2027-01-01");
    expect(reportWeekStart("2026-12-31")).toBe("2026-12-25");
  });
});

describe("reportWeekEnd and reportWeekDays", () => {
  test("the week ends on a Thursday", () => {
    expect(reportWeekEnd("2026-11-13")).toBe("2026-11-19");
    expect(weekdayOf(reportWeekEnd("2026-11-13"))).toBe(4);
  });

  test("seven dates, Friday first", () => {
    expect(reportWeekDays("2026-11-13")).toEqual([
      "2026-11-13",
      "2026-11-14",
      "2026-11-15",
      "2026-11-16",
      "2026-11-17",
      "2026-11-18",
      "2026-11-19",
    ]);
  });
});

describe("lastCompletedWeekStart", () => {
  test("from Friday to Thursday it is the week that ended the Thursday before", () => {
    expect(lastCompletedWeekStart("2026-11-20")).toBe("2026-11-13");
    expect(lastCompletedWeekStart("2026-11-22")).toBe("2026-11-13");
    expect(lastCompletedWeekStart("2026-11-26")).toBe("2026-11-13");
  });

  test("moves on the next Friday", () => {
    expect(lastCompletedWeekStart("2026-11-27")).toBe("2026-11-20");
  });
});

describe("weeksBetween", () => {
  test("counts whole weeks between two Friday starts", () => {
    expect(weeksBetween("2026-10-23", "2026-11-20")).toBe(4);
    expect(weeksBetween("2026-11-13", "2026-11-20")).toBe(1);
    expect(weeksBetween("2026-11-20", "2026-11-20")).toBe(0);
  });

  test("counts across a daylight saving change", () => {
    expect(weeksBetween("2026-10-16", "2026-11-06")).toBe(3);
    expect(weeksBetween("2027-03-19", "2027-04-02")).toBe(2);
  });
});

describe("reportWeekLabel", () => {
  test("day.month to day.month, no year", () => {
    expect(reportWeekLabel("2026-11-13")).toBe("13.11 עד 19.11");
  });

  test("across a month", () => {
    expect(reportWeekLabel("2026-11-27")).toBe("27.11 עד 3.12");
  });
});

describe("writePhase", () => {
  test("Friday 01:00 in winter starts the batch", () => {
    expect(writePhase(at("2026-11-19T23:00:00Z"))).toBe("start");
  });

  test("Friday 00:00 is nothing", () => {
    expect(writePhase(at("2026-11-19T22:00:00Z"))).toBeNull();
  });

  test("Friday 01:00 in summer starts the batch", () => {
    expect(writePhase(at("2027-04-01T22:00:00Z"))).toBe("start");
  });

  test("Friday from 07:30 finishes", () => {
    expect(writePhase(at("2026-11-20T05:30:00Z"))).toBe("finish");
    expect(writePhase(at("2026-11-20T09:59:00Z"))).toBe("finish");
  });

  test("Friday 07:29 and Friday 12:00 are nothing", () => {
    expect(writePhase(at("2026-11-20T05:29:00Z"))).toBeNull();
    expect(writePhase(at("2026-11-20T10:00:00Z"))).toBeNull();
  });

  test("01:00 on another day is nothing", () => {
    expect(writePhase(at("2026-11-20T23:00:00Z"))).toBeNull();
    expect(writePhase(at("2026-11-18T23:00:00Z"))).toBeNull();
  });
});

describe("isSendWindow", () => {
  test("Friday 12:00 sends", () => {
    expect(isSendWindow(at("2026-11-20T10:00:00Z"))).toBe(true);
  });

  test("Friday 12:00 in summer sends", () => {
    expect(isSendWindow(at("2027-04-02T09:00:00Z"))).toBe(true);
  });

  test("Friday 09:00 and Friday 13:00 do not", () => {
    expect(isSendWindow(at("2026-11-20T07:00:00Z"))).toBe(false);
    expect(isSendWindow(at("2026-11-20T11:00:00Z"))).toBe(false);
  });

  test("Saturday never sends", () => {
    expect(isSendWindow(at("2026-11-21T07:00:00Z"))).toBe(false);
    expect(isSendWindow(at("2026-11-21T10:00:00Z"))).toBe(false);
  });

  test("Sunday to Thursday at 09:00 send", () => {
    expect(isSendWindow(at("2026-11-22T07:00:00Z"))).toBe(true);
    expect(isSendWindow(at("2026-11-26T07:00:00Z"))).toBe(true);
  });

  test("Sunday at 12:00 does not", () => {
    expect(isSendWindow(at("2026-11-22T10:00:00Z"))).toBe(false);
  });
});

describe("nextSendLabel", () => {
  test("Friday morning: today at 12:00", () => {
    expect(nextSendLabel(at("2026-11-20T07:30:00Z"))).toBe("השליחה הבאה: היום ב-12:00");
  });

  test("Friday afternoon and Saturday: Sunday at 09:00", () => {
    expect(nextSendLabel(at("2026-11-20T11:30:00Z"))).toBe("השליחה הבאה: ראשון ב-09:00");
    expect(nextSendLabel(at("2026-11-21T08:00:00Z"))).toBe("השליחה הבאה: ראשון ב-09:00");
  });

  test("Sunday to Wednesday: today before 09:00, else tomorrow", () => {
    expect(nextSendLabel(at("2026-11-22T05:00:00Z"))).toBe("השליחה הבאה: היום ב-09:00");
    expect(nextSendLabel(at("2026-11-24T09:00:00Z"))).toBe("השליחה הבאה: מחר ב-09:00");
  });

  test("Thursday after 09:00: Friday at 12:00", () => {
    expect(nextSendLabel(at("2026-11-26T05:00:00Z"))).toBe("השליחה הבאה: היום ב-09:00");
    expect(nextSendLabel(at("2026-11-26T09:00:00Z"))).toBe("השליחה הבאה: שישי ב-12:00");
  });
});
