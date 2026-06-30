import { describe, it, expect } from "vitest";
import { parseMuscleTokens } from "../muscle-utils";

describe("parseMuscleTokens", () => {
  it("returns empty array for null", () => {
    expect(parseMuscleTokens(null)).toEqual([]);
  });

  it("returns empty array for whitespace-only string", () => {
    expect(parseMuscleTokens("   ")).toEqual([]);
  });

  it("returns single token with no emoji for plain text", () => {
    expect(parseMuscleTokens("Core")).toEqual([{ nameHe: "Core", emoji: null }]);
  });

  it("splits on + and extracts leading emoji from first token", () => {
    expect(parseMuscleTokens("\u{1F9B5} קואורדינציה + ירך")).toEqual([
      { nameHe: "קואורדינציה", emoji: "\u{1F9B5}" },
      { nameHe: "ירך", emoji: null },
    ]);
  });

  it("splits on + and extracts leading emoji from first token (second fixture)", () => {
    expect(parseMuscleTokens("\u{1F4A5} גלוטאוס + קוואדריספס")).toEqual([
      { nameHe: "גלוטאוס", emoji: "\u{1F4A5}" },
      { nameHe: "קוואדריספס", emoji: null },
    ]);
  });
});
