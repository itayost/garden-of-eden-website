import { describe, expect, test } from "vitest";

import type { FactSheet } from "../fact-sheet/types";
import { sentenceFacts, splitSentences, type TextPiece } from "../sentence-facts";

function sheet(overrides: Partial<FactSheet> = {}): FactSheet {
  return {
    version: 1,
    week: { from: "2026-11-20", to: "2026-11-26" },
    player: { gender: "male", ageGroup: "U14", position: "קשר", branches: ["קריית אתא"] },
    attendance: {
      total: 2,
      lateCancels: 0,
      days: [
        { date: "2026-11-22", weekday: "יום ראשון", focus: "מסירות", trainers: ["יוסי"], source: "יומן" },
        { date: "2026-11-25", weekday: "יום רביעי", focus: "סיומות לשער", trainers: ["יוסי"], source: "יומן" },
      ],
    },
    workedOn: [{ date: "2026-11-22", source: "דוח משמרת", items: ["מסירה ברגל החלשה"] }],
    progress: [
      {
        date: "2026-11-22",
        source: "תגיות מהאימון",
        label: "תגיות המאמן",
        details: "בעיטה ברגל שמאל",
        categories: ["השקיע", "טכניקה טובה"],
      },
    ],
    habits: {
      checkins: 4,
      sleepAverage: 7.5,
      sleepLowest: 6,
      energyAverage: 4,
      sorenessDays: 0,
      preFormSleep: null,
      postForm: null,
    },
    assessment: null,
    goals: [
      { metric: "ספרינט 10 מטר", baseline: 2.1, current: 2, target: 1.9, unit: "שניות", progressPercent: 50, status: "בדרך" },
    ],
    drills: [],
    nextGame: { date: "2026-11-28", opponent: "הפועל עכו" },
    hasNewMeasurement: false,
    hasDietitianNote: false,
    ...overrides,
  };
}

function labels(pieceFacts: { facts: { label: string }[] }): string[] {
  return pieceFacts.facts.map((fact) => fact.label);
}

function flagged(pieces: readonly TextPiece[]): string[] {
  return pieces.filter((piece) => piece.kind === "unknown_number").map((piece) => piece.text);
}

describe("splitSentences", () => {
  test("splits on a full stop, a question mark or an exclamation mark, and keeps the mark", () => {
    expect(splitSentences("שבוע חזק. הגעת לשני אימונים! ממשיכים?")).toEqual([
      ["שבוע חזק.", "הגעת לשני אימונים!", "ממשיכים?"],
    ]);
  });

  test("keeps paragraphs apart and drops empty ones", () => {
    expect(splitSentences("אחד.\n\nשתיים.\n")).toEqual([["אחד."], ["שתיים."]]);
  });

  test("a decimal point is not the end of a sentence", () => {
    expect(splitSentences("ישנת 7.5 שעות. מעולה.")).toEqual([["ישנת 7.5 שעות.", "מעולה."]]);
  });
});

describe("sentenceFacts", () => {
  test("a sentence naming the days and the count shows those days and the count", () => {
    const [[sentence]] = sentenceFacts("{שם}, הגעת לשני אימונים, ביום ראשון וביום רביעי.", sheet(), "עומר");
    expect(labels(sentence)).toEqual(["2 ימי אימון", "ראשון 22.11 · מסירות", "רביעי 25.11 · סיומות לשער"]);
  });

  test("a focus named without its day still finds its day", () => {
    const [[sentence]] = sentenceFacts("עבדנו על סיומות לשער.", sheet(), "עומר");
    expect(labels(sentence)).toContain("רביעי 25.11 · סיומות לשער");
  });

  test("the coach's name, the tags and the note find their facts", () => {
    const [[sentence]] = sentenceFacts(
      "המאמן יוסי סימן שהשקעת ושהטכניקה טובה, במיוחד הבעיטה ברגל שמאל.",
      sheet(),
      "עומר",
    );
    expect(labels(sentence)).toEqual(expect.arrayContaining(["מאמן: יוסי", "תגית: טכניקה טובה", "הערה: בעיטה ברגל שמאל"]));
  });

  test("sleep, the next game and a Goal find theirs", () => {
    const [[sleep, game, goal]] = sentenceFacts(
      "ישנת בממוצע 7.5 שעות. המשחק מול הפועל עכו קרוב. בספרינט 10 מטר אתה ב-50% מהדרך.",
      sheet(),
      "עומר",
    );
    expect(labels(sleep)).toEqual(["שינה בממוצע 7.5"]);
    expect(labels(game)).toEqual(["משחק: הפועל עכו"]);
    expect(labels(goal)).toEqual(["יעד: ספרינט 10 מטר, 50%"]);
  });

  test("a sentence with nothing in the facts gets no facts", () => {
    const [[sentence]] = sentenceFacts("ממשיכים ככה.", sheet(), "עומר");
    expect(sentence.facts).toEqual([]);
  });

  test("'the first' is not Sunday", () => {
    const [[sentence]] = sentenceFacts("זה היה המבדק הראשון שלך.", sheet(), "עומר");
    expect(labels(sentence)).not.toContain("ראשון 22.11 · מסירות");
  });

  test("a number the facts hold reads as known, one they do not is flagged", () => {
    const [[sentence]] = sentenceFacts("ישנת 7.5 שעות ורצת 12 סיבובים.", sheet(), "עומר");
    expect(sentence.pieces.filter((piece) => piece.kind === "known_number").map((piece) => piece.text)).toEqual(["7.5"]);
    expect(flagged(sentence.pieces)).toEqual(["12"]);
  });

  test("the pieces put the sentence back together, the name filled in", () => {
    const [[sentence]] = sentenceFacts("{שם}, ישנת 7,5 שעות.", sheet(), "עומר");
    expect(sentence.pieces.map((piece) => piece.text).join("")).toBe("עומר, ישנת 7,5 שעות.");
    expect(sentence.pieces[0]).toEqual({ kind: "name", text: "עומר" });
  });

  test("at most four facts a sentence, each once", () => {
    const [[sentence]] = sentenceFacts(
      "בימים ראשון ורביעי עם יוסי עבדנו על מסירות וסיומות לשער, שהשקעת והטכניקה טובה, והבעיטה ברגל שמאל.",
      sheet(),
      "עומר",
    );
    expect(sentence.facts.length).toBeLessThanOrEqual(4);
    expect(new Set(labels(sentence)).size).toBe(sentence.facts.length);
  });
});
