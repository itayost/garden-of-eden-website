import { describe, expect, test } from "vitest";

import { deriveOnDuty, trainersAtTime } from "@/lib/utils/weekly-schedule";
import type { WeeklyBand, WeeklyException } from "@/types/weekly-schedule";

const LIDOR = "11111111-1111-4111-8111-111111111111";
const NADAV = "22222222-2222-4222-8222-222222222222";
const GIMI = "33333333-3333-4333-8333-333333333333";
const AVIAD = "44444444-4444-4444-8444-444444444444";

/** 2026-08-16 is a Sunday; 2026-08-21 is a Friday; 2026-08-22 is a Saturday. */
const SUNDAY = "2026-08-16";
const FRIDAY = "2026-08-21";
const SATURDAY = "2026-08-22";

function band(overrides: Partial<WeeklyBand> = {}): WeeklyBand {
  return {
    id: crypto.randomUUID(),
    weekday: 0,
    start_time: "15:00:00",
    end_time: "18:00:00",
    trainer_id: LIDOR,
    trainer_name: "לידור",
    location_he: "סטודיו",
    label_he: null,
    is_standby: false,
    created_by: LIDOR,
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

function exception(overrides: Partial<WeeklyException> = {}): WeeklyException {
  return {
    id: crypto.randomUUID(),
    exception_date: SUNDAY,
    trainer_id: LIDOR,
    trainer_name: "לידור",
    kind: "absent",
    start_time: null,
    end_time: null,
    location_he: null,
    label_he: null,
    note_he: null,
    created_by: LIDOR,
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

describe("deriveOnDuty", () => {
  test("keeps only the bands for that date's weekday", () => {
    const bands = [
      band({ weekday: 0, trainer_name: "לידור" }),
      band({ weekday: 1, trainer_name: "דין" }),
    ];

    const onDuty = deriveOnDuty(SUNDAY, bands, []);

    expect(onDuty.weekday).toBe(0);
    expect(onDuty.bands).toHaveLength(1);
    expect(onDuty.bands[0].trainerName).toBe("לידור");
  });

  test("trims the DB's HH:MM:SS down to HH:MM", () => {
    const onDuty = deriveOnDuty(SUNDAY, [band()], []);

    expect(onDuty.bands[0].startTime).toBe("15:00");
    expect(onDuty.bands[0].endTime).toBe("18:00");
  });

  test("carries an open-ended band through as a null end", () => {
    const onDuty = deriveOnDuty(SUNDAY, [band({ end_time: null })], []);

    expect(onDuty.bands[0].endTime).toBe(null);
  });

  test("separates standby bands from working ones", () => {
    const bands = [
      band({ trainer_id: LIDOR, trainer_name: "לידור" }),
      band({ trainer_id: NADAV, trainer_name: "נדב", is_standby: true }),
    ];

    const onDuty = deriveOnDuty(SUNDAY, bands, []);

    expect(onDuty.bands.map((b) => b.trainerName)).toEqual(["לידור"]);
    expect(onDuty.standby.map((b) => b.trainerName)).toEqual(["נדב"]);
  });

  test("orders bands by start time, then trainer name", () => {
    const bands = [
      band({ start_time: "18:00:00", trainer_id: GIMI, trainer_name: "גימי" }),
      band({ start_time: "15:00:00", trainer_id: NADAV, trainer_name: "נדב" }),
      band({ start_time: "15:00:00", trainer_id: LIDOR, trainer_name: "לידור" }),
    ];

    const onDuty = deriveOnDuty(SUNDAY, bands, []);

    expect(onDuty.bands.map((b) => b.trainerName)).toEqual([
      "לידור",
      "נדב",
      "גימי",
    ]);
  });

  test("an absence drops every band that trainer has that weekday", () => {
    const bands = [
      band({ start_time: "08:00:00", end_time: "11:00:00" }),
      band({ start_time: "15:00:00" }),
      band({ trainer_id: NADAV, trainer_name: "נדב" }),
    ];

    const onDuty = deriveOnDuty(SUNDAY, bands, [
      exception({ trainer_id: LIDOR, note_he: "חופשה" }),
    ]);

    expect(onDuty.bands.map((b) => b.trainerName)).toEqual(["נדב"]);
    expect(onDuty.absences).toEqual([
      { trainerId: LIDOR, trainerName: "לידור", noteHe: "חופשה" },
    ]);
  });

  test("an absence also removes that trainer's standby band", () => {
    const bands = [band({ trainer_id: NADAV, trainer_name: "נדב", is_standby: true })];

    const onDuty = deriveOnDuty(SUNDAY, bands, [
      exception({ trainer_id: NADAV, trainer_name: "נדב" }),
    ]);

    expect(onDuty.standby).toHaveLength(0);
  });

  test("an absence for another date leaves the day untouched", () => {
    const onDuty = deriveOnDuty(SUNDAY, [band()], [
      exception({ exception_date: "2026-08-23" }),
    ]);

    expect(onDuty.bands).toHaveLength(1);
    expect(onDuty.absences).toHaveLength(0);
  });

  test("an absence for a trainer with no band that day is not reported", () => {
    // Reporting it would put "גימי בחופשה" on a day גימי never works.
    const onDuty = deriveOnDuty(SUNDAY, [band()], [
      exception({ trainer_id: GIMI, trainer_name: "גימי" }),
    ]);

    expect(onDuty.absences).toHaveLength(0);
  });

  test("an extra adds a one-off stretch on that date only", () => {
    const extra = exception({
      kind: "extra",
      trainer_id: AVIAD,
      trainer_name: "אביעד",
      start_time: "16:50:00",
      end_time: "17:20:00",
      location_he: "עתלית",
      label_he: "לידן",
    });

    const onDuty = deriveOnDuty(SUNDAY, [band()], [extra]);

    const added = onDuty.bands.find((b) => b.trainerName === "אביעד");
    expect(added).toMatchObject({
      source: "exception",
      startTime: "16:50",
      endTime: "17:20",
      locationHe: "עתלית",
      labelHe: "לידן",
    });
  });

  test("an extra on another date does not appear", () => {
    const onDuty = deriveOnDuty(SUNDAY, [], [
      exception({
        exception_date: "2026-08-23",
        kind: "extra",
        start_time: "16:00:00",
      }),
    ]);

    expect(onDuty.bands).toHaveLength(0);
  });

  test("a swap resolves to the covering trainer alone", () => {
    // לידור is out, נדב covers: one absence plus one extra.
    const onDuty = deriveOnDuty(
      SUNDAY,
      [band({ trainer_id: LIDOR, trainer_name: "לידור" })],
      [
        exception({ trainer_id: LIDOR, trainer_name: "לידור", note_he: "מילואים" }),
        exception({
          kind: "extra",
          trainer_id: NADAV,
          trainer_name: "נדב",
          start_time: "15:00:00",
          end_time: "18:00:00",
        }),
      ],
    );

    expect(onDuty.bands.map((b) => b.trainerName)).toEqual(["נדב"]);
    expect(onDuty.absences[0].noteHe).toBe("מילואים");
  });

  test("an absence does not remove that trainer's own extra on the same date", () => {
    // The admin wrote both on purpose: off the standing week, on for one hour.
    const onDuty = deriveOnDuty(
      SUNDAY,
      [band({ trainer_id: LIDOR })],
      [
        exception({ trainer_id: LIDOR }),
        exception({
          kind: "extra",
          trainer_id: LIDOR,
          start_time: "19:00:00",
          end_time: null,
        }),
      ],
    );

    expect(onDuty.bands).toHaveLength(1);
    expect(onDuty.bands[0]).toMatchObject({ startTime: "19:00", endTime: null });
  });

  test("a standby extra lands in standby, not in the working bands", () => {
    const onDuty = deriveOnDuty(SUNDAY, [], [
      exception({
        kind: "extra",
        trainer_id: NADAV,
        trainer_name: "נדב",
        start_time: "15:00:00",
        label_he: "חיזוק",
      }),
    ]);

    // An extra is something the admin arranged, so it is real work by default.
    expect(onDuty.bands).toHaveLength(1);
    expect(onDuty.standby).toHaveLength(0);
  });

  test("Friday derives its own bands", () => {
    const bands = [
      band({ weekday: 5, start_time: "09:00:00", end_time: "15:00:00", trainer_name: "דין" }),
      band({ weekday: 0, trainer_name: "לידור" }),
    ];

    const onDuty = deriveOnDuty(FRIDAY, bands, []);

    expect(onDuty.weekday).toBe(5);
    expect(onDuty.bands.map((b) => b.trainerName)).toEqual(["דין"]);
  });

  test("Saturday yields nothing", () => {
    const onDuty = deriveOnDuty(SATURDAY, [band({ weekday: 0 })], []);

    expect(onDuty.weekday).toBe(6);
    expect(onDuty.bands).toHaveLength(0);
    expect(onDuty.standby).toHaveLength(0);
  });

  test("reports the date it derived for", () => {
    expect(deriveOnDuty(SUNDAY, [], []).date).toBe(SUNDAY);
  });
});

describe("trainersAtTime", () => {
  test("returns the trainers whose band covers the hour", () => {
    const onDuty = deriveOnDuty(
      SUNDAY,
      [
        band({ start_time: "15:00:00", end_time: "18:00:00", trainer_name: "לידור" }),
        band({
          start_time: "15:00:00",
          end_time: "18:00:00",
          trainer_id: NADAV,
          trainer_name: "נדב",
        }),
        band({
          start_time: "18:00:00",
          end_time: null,
          trainer_id: GIMI,
          trainer_name: "גימי",
        }),
      ],
      [],
    );

    expect(trainersAtTime(onDuty, "16:00").map((b) => b.trainerName)).toEqual([
      "לידור",
      "נדב",
    ]);
  });

  test("treats the band as half-open: the end hour belongs to the next band", () => {
    const onDuty = deriveOnDuty(
      SUNDAY,
      [
        band({ start_time: "15:00:00", end_time: "18:00:00", trainer_name: "לידור" }),
        band({
          start_time: "18:00:00",
          end_time: null,
          trainer_id: GIMI,
          trainer_name: "גימי",
        }),
      ],
      [],
    );

    expect(trainersAtTime(onDuty, "18:00").map((b) => b.trainerName)).toEqual([
      "גימי",
    ]);
  });

  test("an open-ended band covers every later hour", () => {
    const onDuty = deriveOnDuty(
      SUNDAY,
      [band({ start_time: "18:00:00", end_time: null, trainer_name: "גימי" })],
      [],
    );

    expect(trainersAtTime(onDuty, "23:30")).toHaveLength(1);
  });

  test("includes the start hour", () => {
    const onDuty = deriveOnDuty(SUNDAY, [band({ start_time: "15:00:00" })], []);

    expect(trainersAtTime(onDuty, "15:00")).toHaveLength(1);
  });

  test("excludes standby trainers", () => {
    // A conditional trainer is not a default; nobody has called them in yet.
    const onDuty = deriveOnDuty(
      SUNDAY,
      [
        band({ trainer_id: NADAV, trainer_name: "נדב", is_standby: true }),
        band({ trainer_name: "לידור" }),
      ],
      [],
    );

    expect(trainersAtTime(onDuty, "16:00").map((b) => b.trainerName)).toEqual([
      "לידור",
    ]);
  });

  test("returns nothing outside every band", () => {
    const onDuty = deriveOnDuty(SUNDAY, [band()], []);

    expect(trainersAtTime(onDuty, "09:00")).toHaveLength(0);
  });

  test("accepts an HH:MM:SS time as well as HH:MM", () => {
    const onDuty = deriveOnDuty(SUNDAY, [band()], []);

    expect(trainersAtTime(onDuty, "16:00:00")).toHaveLength(1);
  });
});
