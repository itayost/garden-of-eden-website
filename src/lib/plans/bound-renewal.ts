import { phoneVariants } from "./phone-variants";

/** The renewed Trainee's account, as stored. */
export interface BoundAccount {
  fullName: string | null;
  birthdate: string | null;
  /** Any stored spelling (+972…, 972…, 05…). */
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

const present = (value: string | null): value is string => Boolean(value?.trim());

export interface RenewalLocks {
  childName: boolean;
  childBirthdate: boolean;
  loginPhone: boolean;
}

/** The child fields a renewal shows read-only: whatever the account already has. */
export function renewalLocks(account: BoundAccount): RenewalLocks {
  return {
    childName: present(account.fullName),
    childBirthdate: present(account.birthdate),
    loginPhone: present(account.phone),
  };
}

/**
 * A Renewal belongs to the Trainee its link names. The account's own values
 * win over the form, and a login phone other than the account's is refused:
 * it would sign the parent up under a number the child cannot log in with.
 */
export function bindRenewal(account: BoundAccount, input: BoundInput): BoundResult {
  if (present(account.phone) && !phoneVariants(input.loginPhone).includes(account.phone)) {
    return {
      ok: false,
      error: "הקישור הזה הוא לחידוש עבור חשבון קיים, ומספר הטלפון להתחברות שלו לא ניתן לשינוי כאן.",
    };
  }
  return {
    ok: true,
    childName: present(account.fullName) ? account.fullName.trim() : input.childName,
    childBirthdate: present(account.birthdate) ? account.birthdate : input.childBirthdate,
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
