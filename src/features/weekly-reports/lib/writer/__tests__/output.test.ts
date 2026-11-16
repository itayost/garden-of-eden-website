import { describe, expect, it } from "vitest";
import { finishedText, parseWriterOutput, replyOutcome, WRITER_JSON_SCHEMA, writerOutputSchema } from "../output";

const VALID = {
  player_text: "{שם}, השבוע הגעת לשני אימונים ועבדת על מסירות.",
  parent_text: "{שם} הגיע השבוע לשני אימונים.",
  drill_ids: ["11111111-1111-4111-8111-111111111111"],
};

describe("parseWriterOutput", () => {
  it("accepts a valid JSON string", () => {
    expect(parseWriterOutput(JSON.stringify(VALID))).toEqual(VALID);
  });

  it("accepts an empty drill list", () => {
    expect(parseWriterOutput(JSON.stringify({ ...VALID, drill_ids: [] }))?.drill_ids).toEqual([]);
  });

  it("refuses text that is not JSON", () => {
    expect(parseWriterOutput("{ player_text: ")).toBeNull();
    expect(parseWriterOutput("")).toBeNull();
  });

  it("refuses JSON that is not an object", () => {
    expect(parseWriterOutput("null")).toBeNull();
    expect(parseWriterOutput("[]")).toBeNull();
    expect(parseWriterOutput('"text"')).toBeNull();
  });

  it("refuses a missing field", () => {
    const withoutParent = { player_text: VALID.player_text, drill_ids: VALID.drill_ids };
    expect(parseWriterOutput(JSON.stringify(withoutParent))).toBeNull();
  });

  it("refuses an extra field", () => {
    expect(parseWriterOutput(JSON.stringify({ ...VALID, trainee_name: "x" }))).toBeNull();
  });

  it("refuses a field of the wrong type", () => {
    expect(parseWriterOutput(JSON.stringify({ ...VALID, drill_ids: "a" }))).toBeNull();
    expect(parseWriterOutput(JSON.stringify({ ...VALID, drill_ids: [1] }))).toBeNull();
    expect(parseWriterOutput(JSON.stringify({ ...VALID, player_text: 5 }))).toBeNull();
  });
});

describe("WRITER_JSON_SCHEMA", () => {
  it("is a closed object of the three fields", () => {
    expect(WRITER_JSON_SCHEMA.type).toBe("object");
    expect(WRITER_JSON_SCHEMA.additionalProperties).toBe(false);
    expect([...WRITER_JSON_SCHEMA.required].sort()).toEqual(["drill_ids", "parent_text", "player_text"]);
    expect(WRITER_JSON_SCHEMA.properties.drill_ids).toEqual({ type: "array", items: { type: "string" } });
  });

  it("names the same fields as the Zod schema", () => {
    const zodKeys = Object.keys(writerOutputSchema.shape).sort();
    expect(Object.keys(WRITER_JSON_SCHEMA.properties).sort()).toEqual(zodKeys);
    expect([...WRITER_JSON_SCHEMA.required].sort()).toEqual(zodKeys);
  });
});

describe("finishedText", () => {
  const reply = (stopReason: string | null, text: string | null) => ({
    stopReason,
    text,
    usage: { input_tokens: 10, output_tokens: 20 },
    model: "claude-opus-5-5",
  });

  it("a reply that ran to its end gives its text", () => {
    expect(finishedText(reply("end_turn", "תשובה"))).toEqual({ ok: true, text: "תשובה" });
    expect(finishedText(reply("stop_sequence", "תשובה"))).toEqual({ ok: true, text: "תשובה" });
  });

  it("a refusal is refused with its stop reason, even with text", () => {
    expect(finishedText(reply("refusal", "תשובה"))).toEqual({ ok: false, reason: "refusal" });
  });

  it("a reply cut short is refused with its stop reason, even with text", () => {
    expect(finishedText(reply("max_tokens", "תשובה"))).toEqual({ ok: false, reason: "max_tokens" });
  });

  it("no stop reason is refused as no_stop_reason", () => {
    expect(finishedText(reply(null, "תשובה"))).toEqual({ ok: false, reason: "no_stop_reason" });
  });

  it("a finished reply with no text block is unparsable", () => {
    expect(finishedText(reply("end_turn", null))).toEqual({ ok: false, reason: "unparsable" });
  });

  it("the stop reason is checked before the text", () => {
    expect(finishedText(reply("refusal", null))).toEqual({ ok: false, reason: "refusal" });
  });
});

describe("replyOutcome", () => {
  const usage = { input_tokens: 10, output_tokens: 20 };
  const reply = (stopReason: string | null, text: string | null) => ({
    stopReason,
    text,
    usage,
    model: "claude-opus-5-5",
  });

  it("a finished reply with valid JSON is written", () => {
    expect(replyOutcome(reply("end_turn", JSON.stringify(VALID)))).toEqual({
      ok: true,
      output: VALID,
      usage,
      model: "claude-opus-5-5",
    });
  });

  it("a refusal fails whatever text came with it", () => {
    expect(replyOutcome(reply("refusal", JSON.stringify(VALID)))).toEqual({ ok: false, reason: "refusal" });
  });

  it("a reply cut short fails, even when its text parses", () => {
    expect(replyOutcome(reply("max_tokens", JSON.stringify(VALID)))).toEqual({ ok: false, reason: "max_tokens" });
    expect(replyOutcome(reply("model_context_window_exceeded", JSON.stringify(VALID)))).toEqual({
      ok: false,
      reason: "model_context_window_exceeded",
    });
  });

  it("no text, or text that is not the output, is unparsable", () => {
    expect(replyOutcome(reply("end_turn", null))).toEqual({ ok: false, reason: "unparsable" });
    expect(replyOutcome(reply("end_turn", "שלום"))).toEqual({ ok: false, reason: "unparsable" });
  });
});
