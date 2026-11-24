/**
 * The report reader's view of a text: each sentence with the Fact sheet items
 * it seems to rest on, and its numbers marked known or not. The numbers use
 * the guardrails' own rule (`allowedNumbers()`), so a red number here is one
 * that holds the report. The facts are a loose word match, a pointer for the
 * reader and never a decision. Pure.
 */
import { shortDate } from "@/lib/utils/iso-date";
import { allowedNumbers, numberMatches, numbersIn } from "./fact-sheet/allowed-numbers";
import type { FactSheet } from "./fact-sheet/types";
import { NAME_PLACEHOLDER } from "./fill-name";
import { hasPhrase, overlaps, sameWord, stemsOf, wordsOf } from "./hebrew-words";

export type TextPiece =
  | { kind: "text"; text: string }
  | { kind: "name"; text: string }
  | { kind: "known_number"; text: string }
  | { kind: "unknown_number"; text: string };

export interface FactChip {
  label: string;
}

export interface SentenceView {
  text: string;
  pieces: TextPiece[];
  facts: FactChip[];
}

const MAX_FACTS = 4;
const DETAIL_LENGTH = 40;

/** Paragraphs, each split into sentences after a full stop, question or exclamation mark followed by a space. */
export function splitSentences(text: string): string[][] {
  return text
    .split(/\n\s*\n|\n/)
    .map((paragraph) => sentencesOf(paragraph))
    .filter((sentences) => sentences.length > 0);
}

function sentencesOf(paragraph: string): string[] {
  const sentences: string[] = [];
  let start = 0;
  for (let i = 0; i < paragraph.length; i += 1) {
    const endsHere = ".!?".includes(paragraph[i]) && (i + 1 === paragraph.length || /\s/.test(paragraph[i + 1]));
    if (endsHere) {
      sentences.push(paragraph.slice(start, i + 1).trim());
      start = i + 1;
    }
  }
  const rest = paragraph.slice(start).trim();
  return [...sentences, ...(rest === "" ? [] : [rest])].filter((sentence) => sentence !== "");
}

/** The sentence cut into plain text, the filled-in name and its numbers. */
function piecesOf(sentence: string, firstName: string, allowed: ReadonlySet<string>): TextPiece[] {
  const marks = [
    ...[...sentence.matchAll(/\{שם\}/g)].map((m) => ({ index: m.index ?? 0, length: NAME_PLACEHOLDER.length, piece: { kind: "name", text: firstName } as TextPiece })),
    ...numberMatches(sentence).map((n) => ({
      index: n.index,
      length: n.raw.length,
      piece: { kind: allowed.has(n.value) ? "known_number" : "unknown_number", text: n.raw } as TextPiece,
    })),
  ].sort((a, b) => a.index - b.index);
  const pieces: TextPiece[] = [];
  let at = 0;
  for (const mark of marks) {
    if (mark.index < at) continue;
    if (mark.index > at) pieces.push({ kind: "text", text: sentence.slice(at, mark.index) });
    pieces.push(mark.piece);
    at = mark.index + mark.length;
  }
  return at < sentence.length ? [...pieces, { kind: "text", text: sentence.slice(at) }] : pieces;
}

const COUNT_WORDS: Readonly<Record<number, readonly string[]>> = {
  1: ["אחד", "אחת"],
  2: ["שני", "שתי", "שניים", "שתיים"],
  3: ["שלושה", "שלוש"],
  4: ["ארבעה", "ארבע"],
  5: ["חמישה", "חמש"],
  6: ["שישה", "שש"],
};

const isTrainingWord = (word: string) => stemsOf(word).some((stem) => stem.startsWith("אימונ"));
const isDayWord = (word: string) => stemsOf(word).some((stem) => stem === "יום" || stem === "ימים");

/** "שני אימונים", "3 אימונים": the week's count, said next to the word for trainings. */
function namesTotal(words: readonly string[], total: number): boolean {
  return words.some((word, i) => {
    const next = words[i + 1];
    if (next === undefined || !isTrainingWord(next)) return false;
    return word === String(total) || stemsOf(word).some((stem) => (COUNT_WORDS[total] ?? []).includes(stem));
  });
}

/** "ביום ראשון", "בימים ראשון ורביעי": the weekday's word with ב or ו at most, in a sentence about days. */
function namesWeekday(words: readonly string[], weekday: string): boolean {
  const word = weekday.replace(/^יום /, "");
  const forms = [word, `ב${word}`, `ו${word}`, `וב${word}`];
  return words.some(isDayWord) && words.some((w, i) => forms.includes(w) && !isTrainingWord(words[i + 1] ?? ""));
}

function clip(text: string): string {
  return text.length > DETAIL_LENGTH ? `${text.slice(0, DETAIL_LENGTH - 1)}…` : text;
}

/** A term with a number in it ("ספרינט 10 מטר") matches only a sentence that has that number too. */
function namesMetric(words: readonly string[], numbers: readonly string[], term: string): boolean {
  return overlaps(words, term) && numbersIn(term).every((n) => numbers.includes(n));
}

const SLEEP = ["ישן", "ישנת", "ישנה", "ישנו", "שינה", "לישון"];

function attendanceFacts(sheet: FactSheet, words: readonly string[]): string[] {
  const total = sheet.attendance.total > 1 && namesTotal(words, sheet.attendance.total) ? [`${sheet.attendance.total} ימי אימון`] : [];
  const days = sheet.attendance.days
    .filter((day) => namesWeekday(words, day.weekday) || (day.focus !== null && overlaps(words, day.focus)))
    .map((day) => `${day.weekday.replace(/^יום /, "")} ${shortDate(day.date)}${day.focus ? ` · ${day.focus}` : ""}`);
  const trainers = [...new Set(sheet.attendance.days.flatMap((day) => day.trainers))]
    .filter((name) => words.some((word) => sameWord(word, name)))
    .map((name) => `מאמן: ${name}`);
  return [...total, ...days, ...trainers];
}

function progressFacts(sheet: FactSheet, words: readonly string[]): string[] {
  const workedOn = sheet.workedOn.flatMap((fact) => fact.items.filter((item) => overlaps(words, item)).map((item) => `עבדנו על: ${clip(item)}`));
  const progress = sheet.progress.flatMap((fact) => {
    const tags = fact.source === "תגיות מהאימון";
    const categories = fact.categories
      .filter((category) => hasPhrase(words, category))
      .map((category) => (tags ? `תגית: ${category}` : `${fact.label}: ${category}`));
    const details = fact.details !== null && overlaps(words, fact.details) ? [`${tags ? "הערה" : fact.label}: ${clip(fact.details)}`] : [];
    return [...categories, ...details];
  });
  return [...workedOn, ...progress];
}

function habitFacts(sheet: FactSheet, words: readonly string[], numbers: readonly string[]): string[] {
  const habits = sheet.habits;
  if (habits === null) return [];
  const has = (stems: readonly string[]) => words.some((word) => stems.some((stem) => sameWord(word, stem)));
  const sleep = has(SLEEP);
  return [
    sleep && habits.sleepAverage !== null ? `שינה בממוצע ${habits.sleepAverage}` : null,
    habits.sleepLowest !== null && numbers.includes(String(habits.sleepLowest)) ? `הלילה הקצר ${habits.sleepLowest}` : null,
    sleep && habits.sleepAverage === null && habits.preFormSleep ? `שינה לפי השאלון: ${habits.preFormSleep}` : null,
    has(["אנרגיה"]) && habits.energyAverage !== null ? `אנרגיה בממוצע ${habits.energyAverage}` : null,
    has(["עייפות"]) ? `עייפות שרירים: ${habits.sorenessDays} ימים` : null,
    has(["צ'ק", "צ׳ק"]) && habits.checkins > 0 ? `${habits.checkins} צ'ק-אין` : null,
  ].filter((fact): fact is string => fact !== null);
}

function laterFacts(sheet: FactSheet, words: readonly string[], numbers: readonly string[]): string[] {
  const a = sheet.assessment;
  const assessment =
    a === null
      ? []
      : [
          ...(words.some((word) => sameWord(word, "מבדק")) ? [`מבדק ${shortDate(a.date)}`] : []),
          ...a.improvements.filter((i) => namesMetric(words, numbers, i.label)).map((i) => `${i.label}: ${i.change}`),
          ...(a.rating !== null && numbers.includes(String(a.rating)) ? [`דירוג ${a.rating}`] : []),
        ];
  const goals = sheet.goals.filter((g) => namesMetric(words, numbers, g.metric)).map((g) => `יעד: ${g.metric}, ${g.progressPercent}%`);
  const drills = sheet.drills.filter((d) => overlaps(words, d.name)).map((d) => `תרגיל: ${d.name}`);
  const game = sheet.nextGame !== null && hasPhrase(words, sheet.nextGame.opponent) ? [`משחק: ${sheet.nextGame.opponent}`] : [];
  return [...assessment, ...goals, ...drills, ...game];
}

function factsOf(sentence: string, sheet: FactSheet): FactChip[] {
  const words = wordsOf(sentence.replaceAll(NAME_PLACEHOLDER, " "));
  const numbers = numbersIn(sentence);
  const labels = [
    ...attendanceFacts(sheet, words),
    ...progressFacts(sheet, words),
    ...habitFacts(sheet, words, numbers),
    ...laterFacts(sheet, words, numbers),
  ];
  return [...new Set(labels)].slice(0, MAX_FACTS).map((label) => ({ label }));
}

/** Every paragraph of a text, every sentence with its pieces and its facts. */
export function sentenceFacts(text: string, sheet: FactSheet, firstName: string): SentenceView[][] {
  const allowed = allowedNumbers(sheet);
  return splitSentences(text).map((paragraph) =>
    paragraph.map((sentence) => ({
      text: sentence,
      pieces: piecesOf(sentence, firstName, allowed),
      facts: factsOf(sentence, sheet),
    })),
  );
}
