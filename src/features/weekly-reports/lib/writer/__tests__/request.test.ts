import { afterEach, describe, expect, test, vi } from "vitest";
import { buildFactSheet } from "../../fact-sheet/build";
import { emptyWeek } from "../../fact-sheet/__tests__/fixtures";
import { WRITER_JSON_SCHEMA } from "../output";
import { DEFAULT_WRITER_MODEL, WRITER_MODELS, writerModel, writerParams } from "../request";
import { STYLE_GUIDE } from "../style-guide";

const sheet = buildFactSheet(
  emptyWeek({
    roster: [
      { date: "2026-11-17", startTime: "17:00", focus: "מהירות", slotId: "slot-1", counts: true, lateCancel: false, trainerFirstNames: ["יוסי"] },
    ],
  }),
).sheet;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("writerModel", () => {
  test("Opus 5.5 by default", () => {
    vi.stubEnv("WEEKLY_REPORT_MODEL", "");
    expect(writerModel()).toBe("claude-opus-5-5");
    expect(DEFAULT_WRITER_MODEL).toBe("claude-opus-5-5");
  });

  test("a known model is used, spaces trimmed", () => {
    vi.stubEnv("WEEKLY_REPORT_MODEL", " claude-sonnet-5-5 ");
    expect(writerModel()).toBe("claude-sonnet-5-5");
  });

  test("any other value falls back to Opus 5.5", () => {
    for (const value of ["claude-opus-5", "CLAUDE-SONNET-5-5", "gpt", "claude-sonnet-5-5-20260101"]) {
      vi.stubEnv("WEEKLY_REPORT_MODEL", value);
      expect(writerModel()).toBe("claude-opus-5-5");
    }
  });

  test("the two models of the comparison", () => {
    expect(WRITER_MODELS).toEqual(["claude-opus-5-5", "claude-sonnet-5-5"]);
  });
});

describe("writerParams", () => {
  test("adaptive thinking, medium effort, the JSON schema", () => {
    const params = writerParams(sheet, "claude-sonnet-5-5");
    expect(params.model).toBe("claude-sonnet-5-5");
    expect(params.thinking).toEqual({ type: "adaptive" });
    expect(params.output_config).toEqual({
      effort: "medium",
      format: { type: "json_schema", schema: WRITER_JSON_SCHEMA },
    });
    expect(params.max_tokens).toBe(16000);
  });

  test("sends no sampling settings and no streaming", () => {
    const params = writerParams(sheet, DEFAULT_WRITER_MODEL);
    expect(Object.keys(params).sort()).toEqual(["max_tokens", "messages", "model", "output_config", "system", "thinking"]);
  });

  test("the style guide is the one cached system block", () => {
    expect(writerParams(sheet, DEFAULT_WRITER_MODEL).system).toEqual([
      { type: "text", text: STYLE_GUIDE, cache_control: { type: "ephemeral" } },
    ]);
  });

  test("the only user content is the Fact sheet", () => {
    const params = writerParams(sheet, DEFAULT_WRITER_MODEL);
    expect(params.messages).toEqual([
      { role: "user", content: `דף העובדות של השבוע:\n${JSON.stringify(sheet, null, 2)}` },
    ]);
  });

  test("two sheets share the same prefix up to the user message", () => {
    const other = { ...sheet, attendance: { ...sheet.attendance, total: 3 } };
    const a = writerParams(sheet, DEFAULT_WRITER_MODEL);
    const b = writerParams(other, DEFAULT_WRITER_MODEL);
    expect(a.system).toEqual(b.system);
    expect(a.messages).not.toEqual(b.messages);
  });
});
