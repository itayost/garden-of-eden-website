import { describe, it, expect } from "vitest";
import { bindRenewal, renewalLocks, sameTraineeOrders } from "../bound-renewal";

const account = { fullName: "יואב כהן", birthdate: "2014-03-02", phone: "0521234567" };
const input = { childName: "יואב", childBirthdate: "2015-01-01", loginPhone: "+972521234567" };

describe("bindRenewal", () => {
  it("keeps the account's name and birthdate whatever the form sent", () => {
    expect(bindRenewal(account, input)).toEqual({
      ok: true,
      childName: "יואב כהן",
      childBirthdate: "2014-03-02",
      loginPhone: "+972521234567",
    });
  });

  it("accepts the account's phone in any stored spelling", () => {
    expect(bindRenewal({ ...account, phone: "+972521234567" }, input).ok).toBe(true);
    expect(bindRenewal({ ...account, phone: "972521234567" }, input).ok).toBe(true);
  });

  it("refuses a login phone that is not the account's", () => {
    const result = bindRenewal(account, { ...input, loginPhone: "+972541111111" });
    expect(result.ok).toBe(false);
  });

  it("takes the form's values for what the account is missing", () => {
    expect(bindRenewal({ fullName: null, birthdate: null, phone: null }, input)).toEqual({
      ok: true,
      childName: "יואב",
      childBirthdate: "2015-01-01",
      loginPhone: "+972521234567",
    });
  });

  it("treats a blank stored name as missing", () => {
    const result = bindRenewal({ ...account, fullName: "  " }, input);
    expect(result.ok && result.childName).toBe("יואב");
  });
});

describe("renewalLocks", () => {
  it("locks exactly the fields the account already has", () => {
    expect(renewalLocks(account)).toEqual({ childName: true, childBirthdate: true, loginPhone: true });
    expect(renewalLocks({ fullName: "יואב כהן", birthdate: null, phone: null })).toEqual({
      childName: true,
      childBirthdate: false,
      loginPhone: false,
    });
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
