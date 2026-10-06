import { describe, it, expect } from "vitest";
import { readToken } from "../read-token";

const row = (id: string, over: { cancelled_at?: string | null; late_cancel?: boolean; called_off?: boolean } = {}) => ({
  id,
  cancelled_at: null,
  late_cancel: false,
  called_off: false,
  ...over,
});
const plan = (updated_at: string) => ({ updated_at });

describe("readToken", () => {
  it("is the same for the same roster and Plans in any order", () => {
    const a = readToken([row("r1"), row("r2")], [plan("2026-10-01T10:00:00Z"), plan("2026-10-02T10:00:00Z")]);
    const b = readToken([row("r2"), row("r1")], [plan("2026-10-02T10:00:00Z"), plan("2026-10-01T10:00:00Z")]);
    expect(a).toBe(b);
  });

  it("changes when a Booking is made", () => {
    const plans = [plan("2026-10-01T10:00:00Z")];
    expect(readToken([row("r1")], plans)).not.toBe(readToken([row("r1"), row("r2")], plans));
  });

  it("changes when a Plan is written", () => {
    const rows = [row("r1")];
    expect(readToken(rows, [plan("2026-10-01T10:00:00Z")])).not.toBe(readToken(rows, [plan("2026-10-01T10:00:05Z")]));
  });

  it("ignores rows that use no session", () => {
    const plans = [plan("2026-10-01T10:00:00Z")];
    const base = readToken([row("r1")], plans);
    expect(readToken([row("r1"), row("r2", { cancelled_at: "2026-10-01T09:00:00Z" })], plans)).toBe(base);
    expect(readToken([row("r1"), row("r3", { called_off: true })], plans)).toBe(base);
  });

  it("counts a late cancellation, which still uses a session", () => {
    const plans = [plan("2026-10-01T10:00:00Z")];
    expect(readToken([row("r1"), row("r2", { cancelled_at: "2026-10-01T09:00:00Z", late_cancel: true })], plans)).not.toBe(
      readToken([row("r1")], plans),
    );
  });
});
