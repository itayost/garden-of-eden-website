import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { nextGameSchema, todayInIsrael } from "../next-game";

describe("todayInIsrael", () => {
  it("returns YYYY-MM-DD for the Israel date", () => {
    const fixed = new Date("2026-04-28T15:30:00Z");
    expect(todayInIsrael(fixed)).toBe("2026-04-28");
  });

  it("rolls over after Israel midnight even if UTC is still the previous day", () => {
    // 2026-04-28 21:30 UTC -> 2026-04-29 00:30 Israel (UTC+3 in summer)
    const fixed = new Date("2026-04-28T21:30:00Z");
    expect(todayInIsrael(fixed)).toBe("2026-04-29");
  });
});

describe("nextGameSchema", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-28T09:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("accepts a future date and a non-empty opponent", () => {
    const result = nextGameSchema.safeParse({
      game_date: "2026-05-02",
      opponent: "Hapoel Haifa",
    });
    expect(result.success).toBe(true);
  });

  it("accepts today's Israel date", () => {
    const result = nextGameSchema.safeParse({
      game_date: "2026-04-28",
      opponent: "אלופי המדינה",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a past date", () => {
    const result = nextGameSchema.safeParse({
      game_date: "2026-04-27",
      opponent: "Hapoel",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(["game_date"]);
    }
  });

  it("rejects malformed date strings", () => {
    const result = nextGameSchema.safeParse({
      game_date: "28/04/2026",
      opponent: "X",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty opponent", () => {
    const result = nextGameSchema.safeParse({
      game_date: "2026-05-02",
      opponent: "   ",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an opponent longer than 200 chars", () => {
    const result = nextGameSchema.safeParse({
      game_date: "2026-05-02",
      opponent: "a".repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it("trims whitespace around the opponent", () => {
    const result = nextGameSchema.safeParse({
      game_date: "2026-05-02",
      opponent: "  Maccabi Haifa  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.opponent).toBe("Maccabi Haifa");
    }
  });
});
