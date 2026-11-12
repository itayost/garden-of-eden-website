import { normalizePhoneIL } from "@/lib/validations/common";
import type { RetentionReportData } from "@/lib/arbox/retention";
import type { RetentionViewData, RetentionViewEntry } from "@/lib/arbox/retention-branches";

/**
 * Which retention rows a branch-scoped trainer may see and write. A row
 * linked to a trainee is the trainer's when that trainee is in their
 * branches; Arbox may list another phone for them (#172). A row that matched
 * no trainee falls back to its phone: the phone of a trainee in their
 * branches. Pure: the scope is read by src/lib/retention/scope.ts.
 */
export interface RetentionScope {
  /** Trainee profile ids in the caller's branches. */
  readonly profileIds: ReadonlySet<string>;
  /** Those trainees' own phones, normalized to E.164. */
  readonly phones: ReadonlySet<string>;
}

type ScopedRow = Pick<RetentionViewEntry, "profile_id" | "phone">;

function phoneInScope(rawPhone: string | null, scope: RetentionScope): boolean {
  const phone = normalizePhoneIL(rawPhone);
  return phone !== null && scope.phones.has(phone);
}

export function inRetentionScope(entry: ScopedRow, scope: RetentionScope): boolean {
  if (entry.profile_id !== null) return scope.profileIds.has(entry.profile_id);
  return phoneInScope(entry.phone, scope);
}

/** The report as the caller may see it. Null scope means no restriction. */
export function scopeRetentionView(view: RetentionViewData, scope: RetentionScope | null): RetentionViewData {
  if (scope === null) return view;
  const keep = (entry: RetentionViewEntry) => inRetentionScope(entry, scope);
  return {
    monthly: view.monthly.filter(keep),
    pro: view.pro.filter(keep),
    training_card: view.training_card.filter(keep),
  };
}

/** Same phone: by E.164 when both read as Israeli mobiles, else by exact text. */
function samePhone(a: string | null, b: string): boolean {
  const left = normalizePhoneIL(a);
  const right = normalizePhoneIL(b);
  if (left !== null || right !== null) return left === right;
  return a !== null && a.trim() === b.trim();
}

/**
 * The Arbox users a stored report lists under a phone. Notes, trainers and
 * calls are keyed by the row's phone, so a write is checked by finding whose
 * row that phone is.
 */
export function arboxUserIdsForPhone(report: RetentionReportData, rawPhone: string): number[] {
  if (rawPhone.trim() === "") return [];
  return [...(report.monthly ?? []), ...(report.pro ?? []), ...(report.training_card ?? [])].flatMap((entry) =>
    entry.user_id !== null && samePhone(entry.phone, rawPhone) ? [entry.user_id] : [],
  );
}

/** Trainee profiles by Arbox id and by own phone (E.164, unique among active profiles). */
export interface TraineeIndex {
  readonly byArboxId: ReadonlyMap<number, string>;
  readonly byPhone: ReadonlyMap<string, string>;
}

/**
 * The trainees a phone stands for in these reports, matched the way the
 * report view matches rows: by the Arbox id of every row listing the phone,
 * and by the trainee whose own phone it is. Each trainee once.
 */
export function traineesListedUnder(
  reports: readonly RetentionReportData[],
  rawPhone: string,
  index: TraineeIndex,
): string[] {
  const byArbox = reports.flatMap((report) =>
    arboxUserIdsForPhone(report, rawPhone).flatMap((id) => {
      const trainee = index.byArboxId.get(id);
      return trainee ? [trainee] : [];
    }),
  );
  const phone = normalizePhoneIL(rawPhone);
  const owner = phone !== null ? index.byPhone.get(phone) : undefined;
  return [...new Set(owner ? [...byArbox, owner] : byArbox)];
}

/**
 * Whether a scoped trainer may write a note, trainer, or call under a phone.
 * listedTrainees are the trainees the phone stands for (traineesListedUnder).
 * A phone shared with a trainee outside the trainer's branches is refused,
 * since the note on it is shared too; with nobody listed, only a trainee phone
 * in scope passes.
 */
export function mayWriteRetentionPhone(
  rawPhone: string,
  listedTrainees: readonly string[],
  scope: RetentionScope,
): boolean {
  if (listedTrainees.length > 0) return listedTrainees.every((id) => scope.profileIds.has(id));
  return phoneInScope(rawPhone, scope);
}

/**
 * A month's notes, keyed by phone, as the caller may read them: the same rule
 * as writing one. listedTrainees gives the trainees the report lists under a
 * phone. Null scope means no restriction.
 */
export function scopeRetentionNotes<T>(
  notes: ReadonlyMap<string, T>,
  listedTrainees: (phone: string) => readonly string[],
  scope: RetentionScope | null,
): ReadonlyMap<string, T> {
  if (scope === null) return notes;
  return new Map(
    [...notes].filter(([phone]) => mayWriteRetentionPhone(phone, listedTrainees(phone), scope)),
  );
}
