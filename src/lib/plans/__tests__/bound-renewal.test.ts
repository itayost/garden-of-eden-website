import { describe, it, expect } from "vitest";
import { bindRenewal, renewalLocks, sameTraineeOrders, usableAccount } from "../bound-renewal";

const account = { fullName: "יואב כהן", birthdate: "2014-03-02", phone: "0521234567" };
const input = { childName: "יואב", childBirthdate: "2015-01-01", loginPhone: "+972521234567" };

type Stored = Parameters<typeof usableAccount>[0];
// Callers pass the checked account; these helpers do the same with raw rows.
const bind = (stored: Stored, form: typeof input) => bindRenewal(usableAccount(stored), form);
const locksOf = (stored: Stored) => renewalLocks(usableAccount(stored));

describe("bindRenewal", () => {
  it("keeps the account's name and birthdate whatever the form sent", () => {
    expect(bind(account, input)).toEqual({
      ok: true,
      childName: "יואב כהן",
      childBirthdate: "2014-03-02",
      loginPhone: "+972521234567",
    });
  });

  it.each(["+972521234567", "972521234567", "052-123-4567", "+972 52 123 4567"])(
    "accepts the account's phone stored as %s",
    (phone) => {
      expect(bind({ ...account, phone }, input).ok).toBe(true);
    },
  );

  it("refuses a login phone that is not the account's", () => {
    const result = bind(account, { ...input, loginPhone: "+972541111111" });
    expect(result.ok).toBe(false);
  });

  it("takes the form's values for what the account is missing", () => {
    expect(bind({ fullName: null, birthdate: null, phone: null }, input)).toEqual({
      ok: true,
      childName: "יואב",
      childBirthdate: "2015-01-01",
      loginPhone: "+972521234567",
    });
  });

  it("treats a blank stored name as missing", () => {
    const result = bind({ ...account, fullName: "  " }, input);
    expect(result.ok && result.childName).toBe("יואב");
  });

  it("refuses when the account has a phone it cannot read, instead of taking any", () => {
    expect(bind({ ...account, phone: "not-a-phone" }, input).ok).toBe(false);
  });

  it("treats a stored name or birthdate the form would reject as missing", () => {
    const stale = { fullName: "י", birthdate: "1980-01-01", phone: null };
    expect(bind(stale, input)).toEqual({
      ok: true,
      childName: "יואב",
      childBirthdate: "2015-01-01",
      loginPhone: "+972521234567",
    });
  });
});

describe("renewalLocks", () => {
  it("locks exactly the fields the account already has", () => {
    expect(locksOf(account)).toEqual({ childName: true, childBirthdate: true, loginPhone: true });
    expect(locksOf({ fullName: "יואב כהן", birthdate: null, phone: null })).toEqual({
      childName: true,
      childBirthdate: false,
      loginPhone: false,
    });
  });

  it("never locks a value the parent could not submit", () => {
    expect(locksOf({ fullName: "י", birthdate: "1980-01-01", phone: "not-a-phone" })).toEqual({
      childName: false,
      childBirthdate: false,
      loginPhone: false,
    });
  });
});

describe("usableAccount", () => {
  it("returns the stored values the form accepts, phone as E.164", () => {
    expect(usableAccount({ ...account, fullName: " יואב כהן ", phone: "052-123-4567" })).toEqual({
      fullName: "יואב כהן",
      birthdate: "2014-03-02",
      phone: "+972521234567",
      unreadablePhone: false,
    });
  });

  it("flags a stored phone it cannot read, rather than dropping it silently", () => {
    expect(usableAccount({ ...account, phone: "not-a-phone" })).toMatchObject({
      phone: null,
      unreadablePhone: true,
    });
    expect(usableAccount({ ...account, phone: null }).unreadablePhone).toBe(false);
  });
});

describe("sameTraineeOrders", () => {
  it("matches by login phone alone for a fresh purchase", () => {
    expect(sameTraineeOrders("+972521234567", null)).toBe('login_phone.eq."+972521234567"');
  });
  it("also matches the bound account, so a fresh phone cannot dodge the checks", () => {
    expect(sameTraineeOrders("+972521234567", "8d1c2c1e-0000-4000-8000-000000000001")).toBe(
      'login_phone.eq."+972521234567",profile_id.eq.8d1c2c1e-0000-4000-8000-000000000001',
    );
  });
});
