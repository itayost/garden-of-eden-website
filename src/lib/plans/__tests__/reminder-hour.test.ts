import { describe, expect, it } from "vitest";
import { isReminderHour } from "../reminder-hour";

describe("isReminderHour", () => {
  it("is 09:00 Israel time in summer (UTC+3): the 06:00 UTC run", () => {
    expect(isReminderHour(new Date("2026-10-06T06:00:00Z"))).toBe(true);
    expect(isReminderHour(new Date("2026-10-06T07:00:00Z"))).toBe(false);
  });

  it("is 09:00 Israel time in winter (UTC+2): the 07:00 UTC run", () => {
    expect(isReminderHour(new Date("2026-12-01T07:00:00Z"))).toBe(true);
    expect(isReminderHour(new Date("2026-12-01T06:00:00Z"))).toBe(false);
  });

  it("allows a late start within the hour", () => {
    expect(isReminderHour(new Date("2026-10-06T06:14:00Z"))).toBe(true);
  });
});
