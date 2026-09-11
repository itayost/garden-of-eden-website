import { describe, expect, it } from "vitest";
import { pickRelevantPlan, isPlanRunning } from "../pick-relevant";

const plan = (
  id: string,
  starts_on: string,
  ends_on: string,
  kind: "subscription" | "addon" | "session_card" = "subscription",
  status: "active" | "cancelled" = "active",
) => ({ id, starts_on, ends_on, status, product: { kind } });

describe("pickRelevantPlan", () => {
  it("returns null with no plans", () => {
    expect(pickRelevantPlan([], "2026-09-10")).toBeNull();
  });

  it("prefers the plan running today over a future renewal", () => {
    const a = plan("a", "2026-09-01", "2026-09-30");
    const b = plan("b", "2026-10-01", "2026-10-30");
    expect(pickRelevantPlan([b, a], "2026-09-10")?.id).toBe("a");
  });

  it("shows the soonest scheduled plan when none runs today", () => {
    const later = plan("later", "2026-11-01", "2026-11-30");
    const soon = plan("soon", "2026-10-01", "2026-10-30");
    expect(pickRelevantPlan([later, soon], "2026-09-10")?.id).toBe("soon");
  });

  it("falls back to the plan that ended last", () => {
    const old = plan("old", "2026-01-01", "2026-01-30");
    const recent = plan("recent", "2026-08-01", "2026-08-30");
    expect(pickRelevantPlan([old, recent], "2026-09-10")?.id).toBe("recent");
  });

  it("never picks an add-on when a training plan exists", () => {
    const sub = plan("sub", "2026-09-01", "2026-09-30");
    const addon = plan("addon", "2026-09-05", "2026-10-05", "addon");
    expect(pickRelevantPlan([addon, sub], "2026-09-10")?.id).toBe("sub");
  });

  it("returns null when the trainee only has add-ons", () => {
    expect(pickRelevantPlan([plan("x", "2026-09-01", "2026-09-30", "addon")], "2026-09-10")).toBeNull();
  });

  it("shows a cancelled plan only when nothing else exists", () => {
    const cancelled = plan("c", "2026-09-01", "2026-09-30", "subscription", "cancelled");
    const ended = plan("e", "2026-07-01", "2026-07-30");
    expect(pickRelevantPlan([cancelled, ended], "2026-09-10")?.id).toBe("e");
    expect(pickRelevantPlan([cancelled], "2026-09-10")?.id).toBe("c");
  });

  it("picks the newer of two overlapping windows", () => {
    const a = plan("a", "2026-09-01", "2026-09-30");
    const b = plan("b", "2026-09-05", "2026-10-04");
    expect(pickRelevantPlan([a, b], "2026-09-10")?.id).toBe("b");
  });
});

describe("isPlanRunning", () => {
  it("is true inside the window and false outside or when cancelled", () => {
    expect(isPlanRunning(plan("a", "2026-09-01", "2026-09-30"), "2026-09-30")).toBe(true);
    expect(isPlanRunning(plan("a", "2026-09-01", "2026-09-30"), "2026-10-01")).toBe(false);
    expect(isPlanRunning(plan("a", "2026-09-01", "2026-09-30", "subscription", "cancelled"), "2026-09-10")).toBe(false);
  });
});

describe("toLocalPhone", () => {
  it("handles every stored spelling", async () => {
    const { toLocalPhone } = await import("../local-phone");
    expect(toLocalPhone("+972501234567")).toBe("0501234567");
    expect(toLocalPhone("972501234567")).toBe("0501234567");
    expect(toLocalPhone("0501234567")).toBe("0501234567");
    expect(toLocalPhone(null)).toBe("");
  });
  it("normalizes every spelling to E.164", async () => {
    const { toE164 } = await import("../local-phone");
    expect(toE164("972501234567")).toBe("+972501234567");
    expect(toE164("0501234567")).toBe("+972501234567");
    expect(toE164("+972501234567")).toBe("+972501234567");
  });
});
