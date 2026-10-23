import { normalizePhoneIL } from "@/lib/validations/common";
import {
  getCategoryForMembershipType,
  isEndDateInMonth,
  type RetentionEntry,
  type RetentionReportData,
} from "./retention";

/**
 * Retention attendance split by branch. Arbox is where חיפה trains, so a
 * player's Arbox check-ins are the חיפה column; קריית אתא trains in the app
 * calendar, so its column counts the player's sessions there. A player
 * assigned to a branch (profile_branches) shows 0 there for a month with
 * nothing; a branch they are not assigned to shows a dash unless they trained
 * there anyway.
 *
 * Applied when the report is read, never stored: the snapshot in
 * retention_reports keeps its Arbox shape, and frozen months gain the split.
 */

type CategoryKey = keyof RetentionReportData;

export interface BranchAttendance {
  readonly haifa: readonly (number | null)[];
  readonly kiryat: readonly (number | null)[];
}

export interface RetentionViewEntry extends RetentionEntry {
  readonly branch_attendance: BranchAttendance;
  /** arbox: from the Arbox expiring reports; calendar: a קריית אתא plan queue ending this month. */
  readonly source: "arbox" | "calendar";
}

export interface RetentionViewData {
  readonly monthly: readonly RetentionViewEntry[];
  readonly pro: readonly RetentionViewEntry[];
  readonly training_card: readonly RetentionViewEntry[];
}

/** A trainee profile as the matcher needs it; phone already normalized. */
export interface RetentionProfile {
  readonly id: string;
  readonly phone: string | null;
  readonly arboxUserId: number | null;
  readonly haifa: boolean;
  readonly kiryat: boolean;
}

/** One calendar session that used a session, for one trainee. */
export interface CalendarSession {
  readonly traineeId: string;
  readonly date: string;
}

/** The end of a קריית אתא trainee's Plan queue. */
export interface CalendarPlanEnd {
  readonly profileId: string;
  readonly name: string;
  readonly phone: string | null;
  readonly endsOn: string;
  readonly planName: string;
  readonly cardsOnly: boolean;
}

/** Sessions per trainee for each month key (YYYY-MM), in the keys' order. */
export function calendarMonthCounts(
  sessions: readonly CalendarSession[],
  monthKeys: readonly string[],
): Map<string, number[]> {
  const byTrainee = new Map<string, number[]>();
  for (const session of sessions) {
    const index = monthKeys.indexOf(session.date.slice(0, 7));
    if (index === -1) continue;
    const counts = byTrainee.get(session.traineeId) ?? monthKeys.map(() => 0);
    byTrainee.set(
      session.traineeId,
      counts.map((count, i) => (i === index ? count + 1 : count)),
    );
  }
  return byTrainee;
}

/**
 * The two columns for one player. Arbox reports no check-ins as null and
 * the calendar as 0; both read as "nothing this month" here.
 */
export function branchAttendance(
  arbox: readonly (number | null)[],
  calendar: readonly number[] | undefined,
  assigned: { haifa: boolean; kiryat: boolean },
  monthCount: number,
): BranchAttendance {
  const shown = (count: number | null | undefined, isAssigned: boolean) =>
    count != null && count > 0 ? count : isAssigned ? 0 : null;
  return {
    haifa: Array.from({ length: monthCount }, (_, i) => shown(arbox[i], assigned.haifa)),
    kiryat: Array.from({ length: monthCount }, (_, i) => shown(calendar?.[i], assigned.kiryat)),
  };
}

/** The tab a קריית אתא queue goes under: Arbox's naming rule first, then Card or not. */
export function calendarRetentionCategory(planName: string, cardsOnly: boolean): CategoryKey {
  return getCategoryForMembershipType(planName) ?? (cardsOnly ? "training_card" : "monthly");
}

export interface BranchAttendanceInput {
  readonly reportMonth: string;
  readonly monthKeys: readonly string[];
  readonly profiles: readonly RetentionProfile[];
  /** Calendar sessions per profile id, from calendarMonthCounts. */
  readonly calendarCounts: ReadonlyMap<string, readonly number[]>;
  readonly calendarPlanEnds: readonly CalendarPlanEnd[];
}

const sortByEndDate = (a: RetentionEntry, b: RetentionEntry) => b.end_date.localeCompare(a.end_date);

export function withBranchAttendance(report: RetentionReportData, input: BranchAttendanceInput): RetentionViewData {
  const byArboxId = new Map<number, RetentionProfile>();
  const byPhone = new Map<string, RetentionProfile>();
  for (const p of input.profiles) {
    if (p.arboxUserId !== null) byArboxId.set(p.arboxUserId, p);
    if (p.phone) byPhone.set(p.phone, p);
  }
  const profileById = new Map(input.profiles.map((p) => [p.id, p]));

  const matchProfile = (entry: RetentionEntry): RetentionProfile | undefined => {
    const byId = entry.user_id != null ? byArboxId.get(entry.user_id) : undefined;
    if (byId) return byId;
    const phone = normalizePhoneIL(entry.phone);
    return phone ? byPhone.get(phone) : undefined;
  };

  const monthCount = input.monthKeys.length;
  const listed = new Set<string>();

  const fromArbox = (entry: RetentionEntry): RetentionViewEntry => {
    const match = matchProfile(entry);
    if (match) listed.add(match.id);
    return {
      ...entry,
      source: "arbox",
      branch_attendance: branchAttendance(
        entry.attendance,
        match ? input.calendarCounts.get(match.id) : undefined,
        { haifa: match?.haifa ?? false, kiryat: match?.kiryat ?? false },
        monthCount,
      ),
    };
  };

  const arboxView = {
    monthly: report.monthly.map(fromArbox),
    pro: report.pro.map(fromArbox),
    training_card: report.training_card.map(fromArbox),
  };

  const calendarEntries = input.calendarPlanEnds
    .filter((end) => isEndDateInMonth(end.endsOn, input.reportMonth) && !listed.has(end.profileId))
    .map((end) => {
      const assigned = profileById.get(end.profileId);
      const view: RetentionViewEntry = {
        user_id: assigned?.arboxUserId ?? null,
        name: end.name,
        phone: end.phone,
        end_date: end.endsOn,
        membership_type_name: end.planName,
        attendance: input.monthKeys.map(() => null),
        source: "calendar",
        branch_attendance: branchAttendance(
          [],
          input.calendarCounts.get(end.profileId),
          { haifa: assigned?.haifa ?? false, kiryat: true },
          monthCount,
        ),
      };
      return { category: calendarRetentionCategory(end.planName, end.cardsOnly), view };
    });

  const withCalendar = (key: CategoryKey) =>
    [...arboxView[key], ...calendarEntries.filter((c) => c.category === key).map((c) => c.view)].sort(sortByEndDate);

  return {
    monthly: withCalendar("monthly"),
    pro: withCalendar("pro"),
    training_card: withCalendar("training_card"),
  };
}
