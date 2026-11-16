import { describe, expect, test } from "vitest";
import type { Checkin } from "@/features/checkins/lib/checkin";
import { habitsFacts } from "../habits";

const checkins: Checkin[] = [
  { date: "2026-11-14", sleepHours: 7, energy: 3, soreness: true },
  { date: "2026-11-15", sleepHours: 8, energy: 4, soreness: false },
  { date: "2026-11-16", sleepHours: 7.5, energy: 5, soreness: true },
];

describe("habitsFacts", () => {
  test("averages sleep and energy, finds the lowest sleep and counts sore days", () => {
    expect(habitsFacts(checkins, [], [])).toEqual({
      checkins: 3,
      sleepAverage: 7.5,
      sleepLowest: 7,
      energyAverage: 4,
      sorenessDays: 2,
      preFormSleep: null,
      postForm: null,
    });
  });

  test("averages are rounded to one decimal", () => {
    const facts = habitsFacts(
      [
        { date: "2026-11-14", sleepHours: 7, energy: 3, soreness: false },
        { date: "2026-11-15", sleepHours: 7, energy: 3, soreness: false },
        { date: "2026-11-16", sleepHours: 8, energy: 4, soreness: false },
      ],
      [],
      [],
    );
    expect(facts?.sleepAverage).toBe(7.3);
    expect(facts?.energyAverage).toBe(3.3);
  });

  test("the pre-workout sleep range is used only without Check-ins", () => {
    const pre = [
      { date: "2026-11-14", sleepRange: "6-8" as const },
      { date: "2026-11-15", sleepRange: "4-6" as const },
      { date: "2026-11-16", sleepRange: "6-8" as const },
    ];
    expect(habitsFacts([], pre, [])?.preFormSleep).toBe("6-8 שעות");
    expect(habitsFacts(checkins, pre, [])?.preFormSleep).toBeNull();
  });

  test("post-workout difficulty and satisfaction are averaged over the answers given", () => {
    const facts = habitsFacts(
      [],
      [],
      [
        { date: "2026-11-14", difficulty: 6, satisfaction: 8 },
        { date: "2026-11-16", difficulty: 7, satisfaction: null },
      ],
    );
    expect(facts).toMatchObject({
      checkins: 0,
      sleepAverage: null,
      postForm: { difficultyAverage: 6.5, satisfactionAverage: 8 },
    });
  });

  test("null for a week with none of the three", () => {
    expect(habitsFacts([], [], [])).toBeNull();
    expect(habitsFacts([], [{ date: "2026-11-14", sleepRange: null }], [])).toBeNull();
  });
});
