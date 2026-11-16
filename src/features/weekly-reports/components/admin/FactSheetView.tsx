import { GENDER_LABELS } from "@/lib/profile/gender";
import { shortDate } from "@/lib/utils/iso-date";
import type { BodyFacts, FactSheet, Habits } from "../../lib/fact-sheet/types";
import { goalLine } from "../../lib/report-view";
import { BodyBlock } from "../report/BodyBlock";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-xs font-bold text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function Nothing() {
  return <p className="text-sm text-muted-foreground">אין</p>;
}

/** "דוח משמרת, המאמן יוסי · 17.11" */
function sourceLine(source: string, date: string) {
  return (
    <span className="text-xs text-muted-foreground">
      {source} · {shortDate(date)}
    </span>
  );
}

function habitLines(habits: Habits): string[] {
  const lines = [
    habits.checkins > 0 ? `${habits.checkins} צ'ק-אין בשבוע` : null,
    habits.sleepAverage === null
      ? null
      : `שינה: ממוצע ${habits.sleepAverage} שעות${habits.sleepLowest === null ? "" : `, הכי מעט ${habits.sleepLowest}`}`,
    habits.energyAverage === null ? null : `אנרגיה: ממוצע ${habits.energyAverage} מתוך 5`,
    habits.checkins > 0 ? `עייפות שרירים: ${habits.sorenessDays} ימים` : null,
    habits.preFormSleep ? `שינה לפי שאלון לפני אימון: ${habits.preFormSleep}` : null,
    habits.postForm?.difficultyAverage == null ? null : `קושי האימון: ממוצע ${habits.postForm.difficultyAverage} מתוך 10`,
    habits.postForm?.satisfactionAverage == null
      ? null
      : `שביעות רצון: ממוצע ${habits.postForm.satisfactionAverage} מתוך 10`,
  ];
  return lines.filter((line): line is string => line !== null);
}

function Lines({ lines }: { lines: readonly string[] }) {
  if (lines.length === 0) return <Nothing />;
  return (
    <ul className="space-y-0.5 text-sm">
      {lines.map((line, index) => (
        <li key={index}>{line}</li>
      ))}
    </ul>
  );
}

function PlayerLine({ player }: { player: FactSheet["player"] }) {
  const parts = [
    player.gender ? GENDER_LABELS[player.gender] : "מגדר חסר",
    player.ageGroup,
    player.position,
    player.branches.join(", "),
  ].filter((part): part is string => Boolean(part));
  return <p className="text-sm">{parts.join(" · ")}</p>;
}

function Attendance({ attendance }: { attendance: FactSheet["attendance"] }) {
  return (
    <Section title="נוכחות">
      <p className="text-sm">
        {attendance.total === 1 ? "יום אימון אחד" : `${attendance.total} ימי אימון`}
        {attendance.lateCancels > 0 ? ` · ${attendance.lateCancels} ביטולים מאוחרים` : ""}
      </p>
      <ul className="space-y-0.5 text-sm">
        {attendance.days.map((day) => (
          <li key={day.date}>
            {day.weekday} {shortDate(day.date)}
            {day.focus ? ` · ${day.focus}` : ""}
            {day.trainers.length > 0 ? ` · ${day.trainers.join(", ")}` : ""}
            {day.source === "ארבוקס" ? " · ארבוקס" : ""}
          </li>
        ))}
      </ul>
    </Section>
  );
}

function WorkedOn({ items }: { items: FactSheet["workedOn"] }) {
  return (
    <Section title="מה עשינו">
      {items.length === 0 ? (
        <Nothing />
      ) : (
        <ul className="space-y-2">
          {items.map((entry, index) => (
            <li key={index} className="space-y-0.5">
              {sourceLine(entry.source, entry.date)}
              <Lines lines={entry.items} />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function Progress({ items }: { items: FactSheet["progress"] }) {
  return (
    <Section title="התקדמות">
      {items.length === 0 ? (
        <Nothing />
      ) : (
        <ul className="space-y-2">
          {items.map((item, index) => (
            <li key={index} className="space-y-0.5 text-sm">
              {sourceLine(item.source, item.date)}
              <p>
                <span className="font-medium">{item.label}</span>
                {item.categories.length > 0 ? `: ${item.categories.join(", ")}` : ""}
              </p>
              {item.details && <p className="whitespace-pre-line text-muted-foreground">{item.details}</p>}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function Assessment({ assessment }: { assessment: FactSheet["assessment"] }) {
  if (assessment === null) return <Section title="מבדק"><Nothing /></Section>;
  const lines = [
    `מבדק מ-${shortDate(assessment.date)}${assessment.first ? " (ראשון)" : ""}`,
    ...assessment.improvements.map((item) => `${item.label}: ${item.change}`),
    assessment.first ? null : `ללא שינוי: ${assessment.unchanged} · ירידה: ${assessment.regressions}`,
    assessment.rating === null ? null : `דירוג: ${assessment.rating}`,
  ].filter((line): line is string => line !== null);
  return (
    <Section title="מבדק">
      <Lines lines={lines} />
    </Section>
  );
}

function Goals({ goals }: { goals: FactSheet["goals"] }) {
  return (
    <Section title="יעדים">
      <Lines lines={goals.map((goal) => `${goal.metric}: ${goalLine(goal)} · ${goal.progressPercent}% · ${goal.status}`)} />
    </Section>
  );
}

interface FactSheetViewProps {
  sheet: FactSheet;
  body: BodyFacts | null;
}

/**
 * The Fact sheet as the model saw it, in labelled sections, and apart from
 * it the body block, which code shows to the reader and the model never sees.
 */
export function FactSheetView({ sheet, body }: FactSheetViewProps) {
  return (
    <div className="space-y-4">
      <PlayerLine player={sheet.player} />
      <Attendance attendance={sheet.attendance} />
      <WorkedOn items={sheet.workedOn} />
      <Progress items={sheet.progress} />
      <Section title="הרגלים">
        <Lines lines={sheet.habits ? habitLines(sheet.habits) : []} />
      </Section>
      <Assessment assessment={sheet.assessment} />
      <Goals goals={sheet.goals} />
      {sheet.drills.length > 0 && (
        <Section title="תרגילים מוצעים">
          <Lines lines={sheet.drills.map((drill) => (drill.goal ? `${drill.name} (ליעד: ${drill.goal})` : drill.name))} />
        </Section>
      )}
      <Section title="משחק קרוב">
        <Lines lines={sheet.nextGame ? [`${shortDate(sheet.nextGame.date)} נגד ${sheet.nextGame.opponent}`] : []} />
      </Section>
      {body && (
        <div className="space-y-2 rounded-lg border border-dashed p-3">
          <p className="text-xs font-medium text-muted-foreground">מוצג להורה ולשחקן כפי שהוא, לא נשלח למודל</p>
          <BodyBlock body={body} />
        </div>
      )}
    </div>
  );
}
