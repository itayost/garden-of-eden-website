import { describe, expect, it } from "vitest";
import { key, materializationPlan } from "../materialization";
import type { WeeklyBand, WeeklyException } from "@/types/weekly-schedule";

const band = (overrides: Partial<WeeklyBand>): WeeklyBand => ({
  id: "b1",
  weekday: 0,
  start_time: "16:00:00",
  end_time: "17:00:00",
  trainer_id: "t1",
  trainer_name: "לידור",
  location_he: null,
  branch_id: "ka",
  label_he: "ילדים",
  is_standby: false,
  max_trainees: 8,
  is_bookable: true,
  created_by: "u",
  created_at: "",
  updated_at: "",
  ...overrides,
});

const sunday = "2026-09-13";
const monday = "2026-09-14";

describe("materializationPlan", () => {
  it("projects bookable bands onto their weekday only", () => {
    const plan = materializationPlan({
      dates: [sunday, monday],
      bands: [band({}), band({ id: "b2", weekday: 1 })],
      exceptions: [],
      existing: new Set(),
      tombstones: new Set(),
    });
    expect(plan.map((p) => [p.date, p.band.id])).toEqual([[sunday, "b1"], [monday, "b2"]]);
  });

  it("skips standby, non-bookable, existing, and tombstoned slots", () => {
    const plan = materializationPlan({
      dates: [sunday],
      bands: [
        band({}),
        band({ id: "standby", is_standby: true }),
        band({ id: "staffonly", is_bookable: false }),
        band({ id: "exists" }),
        band({ id: "deleted" }),
      ],
      exceptions: [],
      existing: new Set([key(sunday, "exists")]),
      tombstones: new Set([key(sunday, "deleted")]),
    });
    expect(plan.map((p) => p.band.id)).toEqual(["b1"]);
  });

  it("drops a band when its trainer is absent that day", () => {
    const absence: WeeklyException = {
      id: "e1",
      exception_date: sunday,
      trainer_id: "t1",
      trainer_name: "לידור",
      kind: "absent",
      start_time: null,
      end_time: null,
      location_he: null,
      branch_id: "ka",
      label_he: null,
      note_he: null,
      created_by: "u",
      created_at: "",
      updated_at: "",
    };
    const plan = materializationPlan({
      dates: [sunday, "2026-09-20"],
      bands: [band({})],
      exceptions: [absence],
      existing: new Set(),
      tombstones: new Set(),
    });
    expect(plan.map((p) => p.date)).toEqual(["2026-09-20"]);
  });
});
