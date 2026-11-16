import { describe, expect, it } from "vitest";
import { numbersIn } from "../../fact-sheet/allowed-numbers";
import { forbiddenIn } from "../../forbidden-words";
import { LENGTH_FACTOR, PARENT_TARGET_WORDS, PLAYER_TARGET_WORDS } from "../../guardrails";
import { SAMPLE_REPORTS, samplesText } from "../sample-reports";

const words = (text: string) => text.split(/\s+/).filter((word) => word !== "").length;

describe("sample reports", () => {
  it("has three to five samples", () => {
    expect(SAMPLE_REPORTS.length).toBeGreaterThanOrEqual(3);
    expect(SAMPLE_REPORTS.length).toBeLessThanOrEqual(5);
  });

  it.each(SAMPLE_REPORTS.map((sample, index) => [index + 1, sample] as const))(
    "sample %i follows the rules it teaches",
    (_index, sample) => {
      const allowed = new Set(numbersIn(sample.facts));
      const texts = [sample.playerText, sample.parentText];
      for (const text of texts) {
        expect(numbersIn(text).filter((n) => !allowed.has(n))).toEqual([]);
        expect(forbiddenIn(text)).toEqual([]);
        expect(text).toContain("{שם}");
        expect(text).not.toMatch(/[–—]/);
        expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
      }
      expect(words(sample.playerText)).toBeLessThanOrEqual(PLAYER_TARGET_WORDS);
      expect(words(sample.parentText)).toBeLessThanOrEqual(PARENT_TARGET_WORDS * LENGTH_FACTOR);
    },
  );

  it("renders each sample with its facts and both texts", () => {
    const text = samplesText(SAMPLE_REPORTS);
    expect(text).toContain("### דוגמה 1");
    expect(text.match(/player_text:/g)).toHaveLength(SAMPLE_REPORTS.length);
    expect(text.match(/parent_text:/g)).toHaveLength(SAMPLE_REPORTS.length);
  });
});
