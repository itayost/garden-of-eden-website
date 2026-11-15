import { describe, expect, it } from "vitest";
import {
  ageOn,
  noParentRefusal,
  parentPhoneRefusal,
  shouldAskParentPhone,
  type ParentPromptProfile,
} from "../prompt";

const TODAY = "2026-11-15";

const CHILD: ParentPromptProfile = {
  role: "trainee",
  guardianPhone: null,
  guardianNotNeeded: false,
  birthdate: "2014-05-03",
  dismissedOn: null,
};

describe("ageOn", () => {
  it("counts whole years, a birthday included", () => {
    expect(ageOn("2008-11-16", TODAY)).toBe(17);
    expect(ageOn("2008-11-15", TODAY)).toBe(18);
  });

  it("gives a 29 February birthday the lower age on 28 February", () => {
    expect(ageOn("2008-02-29", "2026-02-28")).toBe(17);
    expect(ageOn("2008-02-29", "2026-03-01")).toBe(18);
  });
});

describe("shouldAskParentPhone", () => {
  it("asks a child with no parent phone", () => {
    expect(shouldAskParentPhone(CHILD, TODAY)).toBe(true);
  });

  it("asks when the birthdate is unknown", () => {
    expect(shouldAskParentPhone({ ...CHILD, birthdate: null }, TODAY)).toBe(true);
  });

  it("never asks staff", () => {
    expect(shouldAskParentPhone({ ...CHILD, role: "trainer" }, TODAY)).toBe(false);
    expect(shouldAskParentPhone({ ...CHILD, role: null }, TODAY)).toBe(false);
  });

  it("does not ask when a parent phone is stored", () => {
    expect(shouldAskParentPhone({ ...CHILD, guardianPhone: "+972501234567" }, TODAY)).toBe(false);
  });

  it("asks when the stored phone is only spaces", () => {
    expect(shouldAskParentPhone({ ...CHILD, guardianPhone: "  " }, TODAY)).toBe(true);
  });

  it("does not ask someone who said they are over 18", () => {
    expect(shouldAskParentPhone({ ...CHILD, guardianNotNeeded: true }, TODAY)).toBe(false);
  });

  it("does not ask an adult by birthdate", () => {
    expect(shouldAskParentPhone({ ...CHILD, birthdate: "2008-11-15" }, TODAY)).toBe(false);
  });

  it("waits 7 days after 'not now'", () => {
    expect(shouldAskParentPhone({ ...CHILD, dismissedOn: "2026-11-09" }, TODAY)).toBe(false);
    expect(shouldAskParentPhone({ ...CHILD, dismissedOn: "2026-11-08" }, TODAY)).toBe(true);
  });
});

describe("parentPhoneRefusal", () => {
  it("refuses the child's own phone in another spelling", () => {
    expect(parentPhoneRefusal("+972501234567", "972501234567")).toBe(
      "זה המספר שלך. צריך את המספר של אחד ההורים",
    );
    expect(parentPhoneRefusal("050-123-4567", "+972501234567")).not.toBeNull();
  });

  it("accepts a different number", () => {
    expect(parentPhoneRefusal("+972521234567", "+972501234567")).toBeNull();
  });

  it("accepts any number when the child has no phone", () => {
    expect(parentPhoneRefusal("+972521234567", null)).toBeNull();
  });
});

describe("noParentRefusal", () => {
  it("refuses a known birthdate under 18", () => {
    expect(noParentRefusal("2008-11-16", TODAY)).toBe("האפשרות הזו מיועדת רק למי שמעל גיל 18");
  });

  it("allows 18 and an unknown birthdate", () => {
    expect(noParentRefusal("2008-11-15", TODAY)).toBeNull();
    expect(noParentRefusal(null, TODAY)).toBeNull();
  });
});
