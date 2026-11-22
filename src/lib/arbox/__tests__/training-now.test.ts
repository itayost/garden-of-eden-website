import { describe, expect, test } from "vitest";
import { isTrainingMembership, type ProductTypes } from "../access";
import { trainingNowFromRows } from "../training-now";

const products: ProductTypes = {
  paid: new Set(["מנוי חודשי", "כרטיסייה 10"]),
  known: new Set(["מנוי חודשי", "כרטיסייה 10", "קורס דיגיטלי", "שיעור ניסיון"]),
};

const none = { memberships: [], cards: [], onHold: [], products };

describe("isTrainingMembership", () => {
  test("the row's own type decides when it has one", () => {
    expect(isTrainingMembership({ membership_type_type: "plan" }, products)).toBe(true);
    expect(isTrainingMembership({ membership_type_type: "session" }, products)).toBe(true);
    expect(
      isTrainingMembership({ membership_type_type: "item", membership_type_name: "מנוי חודשי" }, products),
    ).toBe(false);
  });

  test("a paid product name counts", () => {
    expect(isTrainingMembership({ membership_type_name: "מנוי חודשי" }, products)).toBe(true);
  });

  test("a known product that is not a plan or a session does not count", () => {
    expect(isTrainingMembership({ membership_type_name: "קורס דיגיטלי" }, products)).toBe(false);
    expect(isTrainingMembership({ membership_type_name: "שיעור ניסיון" }, products)).toBe(false);
  });

  test("a product the catalogue does not know counts, so a renamed one never locks a member", () => {
    expect(isTrainingMembership({ membership_type_name: "מנוי ישן שנמחק" }, products)).toBe(true);
  });

  test("a row with neither a type nor a name does not count", () => {
    expect(isTrainingMembership({}, products)).toBe(false);
  });
});

describe("trainingNowFromRows", () => {
  test("an active training membership counts its user", () => {
    const result = trainingNowFromRows({
      ...none,
      memberships: [{ user_id: 11, membership_type_name: "מנוי חודשי" }],
    });
    expect([...result.ids]).toEqual([11]);
  });

  test("an active membership that is not training does not count", () => {
    const result = trainingNowFromRows({
      ...none,
      memberships: [{ user_id: 11, membership_type_name: "קורס דיגיטלי" }],
    });
    expect(result.ids.size).toBe(0);
  });

  test("every live card counts, whatever its sessions left", () => {
    const result = trainingNowFromRows({
      ...none,
      cards: [
        { user_id: 21, sessions_left: 0 },
        { user_id: "22", sessions_left: "5" },
      ],
    });
    expect([...result.ids].sort()).toEqual([21, 22]);
  });

  test("a member on hold counts", () => {
    const result = trainingNowFromRows({ ...none, onHold: [{ user_id: 31 }] });
    expect([...result.ids]).toEqual([31]);
  });

  test("rows without a usable user id are skipped", () => {
    const result = trainingNowFromRows({
      ...none,
      memberships: [{ user_id: null, membership_type_name: "מנוי חודשי" }],
      cards: [{ user_id: "" }, { user_id: 0 }],
      onHold: [{ user_id: "abc" }, {}],
    });
    expect(result.ids.size).toBe(0);
  });

  test("a user in several reports is counted once", () => {
    const result = trainingNowFromRows({
      ...none,
      memberships: [{ user_id: 5, membership_type_name: "מנוי חודשי" }],
      cards: [{ user_id: 5 }],
      onHold: [{ user_id: "5" }],
    });
    expect([...result.ids]).toEqual([5]);
  });

  test("row counts are the raw report sizes", () => {
    const result = trainingNowFromRows({
      ...none,
      memberships: [
        { user_id: 1, membership_type_name: "מנוי חודשי" },
        { user_id: 2, membership_type_name: "קורס דיגיטלי" },
      ],
      cards: [{ user_id: 3 }],
      onHold: [],
    });
    expect(result.rows).toEqual({ memberships: 2, cards: 1, onHold: 0 });
  });
});
