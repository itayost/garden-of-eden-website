import { isValidPhoneIL } from "@/lib/validations/common";
import { childBirthdateField, childNameField } from "@/lib/validations/enrollment";
import { toE164 } from "./local-phone";

/** The renewed Trainee's account, as stored. */
export interface BoundAccount {
  fullName: string | null;
  birthdate: string | null;
  /** Any stored spelling (+972…, 972…, 05…, with or without separators). */
  phone: string | null;
}

/** What the parent submitted; loginPhone is already E.164 from the schema. */
export interface BoundInput {
  childName: string;
  childBirthdate: string;
  loginPhone: string;
}

export type BoundResult =
  | { ok: true; childName: string; childBirthdate: string; loginPhone: string }
  | { ok: false; error: string };

export interface RenewalLocks {
  childName: boolean;
  childBirthdate: boolean;
  loginPhone: boolean;
}

/**
 * The stored values the enrollment form would accept, phone as E.164. A value
 * the form would reject counts as missing: locking it read-only would leave the
 * parent stuck on a validation error they cannot fix.
 */
export function usableAccount(account: BoundAccount): BoundAccount {
  const name = childNameField.safeParse(account.fullName ?? "");
  const birthdate = childBirthdateField.safeParse(account.birthdate ?? "");
  return {
    fullName: name.success ? name.data : null,
    birthdate: birthdate.success ? birthdate.data : null,
    phone: isValidPhoneIL(account.phone) ? toE164(account.phone) : null,
  };
}

/** Checkout only binds an active trainee; the form must apply the same rule. */
export function isActiveTrainee(profile: { role: string | null; deleted_at: string | null }): boolean {
  return profile.deleted_at === null && profile.role === "trainee";
}

/** The child fields a renewal shows read-only, from usableAccount(). */
export function renewalLocks(usable: BoundAccount): RenewalLocks {
  return {
    childName: usable.fullName !== null,
    childBirthdate: usable.birthdate !== null,
    loginPhone: usable.phone !== null,
  };
}

/**
 * A Renewal belongs to the Trainee its link names (pass usableAccount()). The account's own values
 * win over the form, and a login phone other than the account's is refused:
 * it would sign the parent up under a number the child cannot log in with.
 */
export function bindRenewal(usable: BoundAccount, input: BoundInput): BoundResult {
  if (usable.phone !== null && usable.phone !== toE164(input.loginPhone)) {
    return {
      ok: false,
      error: "הקישור הזה הוא לחידוש עבור חשבון קיים, ומספר הטלפון להתחברות שלו לא ניתן לשינוי כאן.",
    };
  }
  return {
    ok: true,
    childName: usable.fullName ?? input.childName,
    childBirthdate: usable.birthdate ?? input.childBirthdate,
    loginPhone: input.loginPhone,
  };
}

/**
 * A PostgREST `or` filter for the orders of one purchaser: the login phone,
 * and for a bound Renewal also the account itself, so typing a fresh phone
 * cannot dodge the once-only intro pack or the stuck-charge guard.
 */
export function sameTraineeOrders(loginPhone: string, profileId: string | null): string {
  const byPhone = `login_phone.eq."${loginPhone}"`;
  return profileId ? `${byPhone},profile_id.eq.${profileId}` : byPhone;
}
