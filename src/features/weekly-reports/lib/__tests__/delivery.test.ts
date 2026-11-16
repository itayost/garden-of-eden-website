import { describe, expect, it } from "vitest";
import { parentDelivery, SKIP_REASON_LABELS, skipLabel } from "../delivery";

const TODAY = "2026-11-20";

const BASE = {
  guardianPhone: "054-123-4567",
  guardianNotNeeded: false,
  birthdate: "2012-03-04",
  today: TODAY,
  templateConfigured: true,
};

describe("parentDelivery", () => {
  it("sends to the normalized number of a 17 year old's parent", () => {
    expect(parentDelivery({ ...BASE, birthdate: "2008-11-21" })).toEqual({
      send: true,
      phone: "+972541234567",
    });
  });

  it("gives adult for an 18 year old whose birthday is today", () => {
    expect(parentDelivery({ ...BASE, birthdate: "2008-11-20" })).toEqual({ send: false, reason: "adult" });
  });

  it("sends when the birthdate is unknown", () => {
    expect(parentDelivery({ ...BASE, birthdate: null })).toEqual({ send: true, phone: "+972541234567" });
  });

  it("gives adult when no parent is needed", () => {
    expect(parentDelivery({ ...BASE, birthdate: null, guardianNotNeeded: true })).toEqual({
      send: false,
      reason: "adult",
    });
  });

  it("gives no_phone for a blank or unparsable phone", () => {
    expect(parentDelivery({ ...BASE, guardianPhone: null })).toEqual({ send: false, reason: "no_phone" });
    expect(parentDelivery({ ...BASE, guardianPhone: "   " })).toEqual({ send: false, reason: "no_phone" });
    expect(parentDelivery({ ...BASE, guardianPhone: "12345" })).toEqual({ send: false, reason: "no_phone" });
  });

  it("gives no_template when the template is not configured", () => {
    expect(parentDelivery({ ...BASE, templateConfigured: false })).toEqual({
      send: false,
      reason: "no_template",
    });
  });

  it("says adult before no_phone, and no_phone before no_template", () => {
    expect(
      parentDelivery({ ...BASE, guardianNotNeeded: true, guardianPhone: null, templateConfigured: false }),
    ).toEqual({ send: false, reason: "adult" });
    expect(parentDelivery({ ...BASE, guardianPhone: null, templateConfigured: false })).toEqual({
      send: false,
      reason: "no_phone",
    });
  });
});

describe("skipLabel", () => {
  it("labels every stored reason in Hebrew", () => {
    expect(skipLabel("no_template")).toBe(SKIP_REASON_LABELS.no_template);
    expect(skipLabel("no_phone")).toBe("אין טלפון של הורה");
    expect(skipLabel("adult")).toBe("מעל גיל 18");
  });

  it("labels a WhatsApp failure stored with its error", () => {
    expect(skipLabel("whatsapp_failed: (#131026) Message undeliverable")).toBe("השליחה בוואטסאפ נכשלה");
    expect(skipLabel("whatsapp_failed")).toBe("השליחה בוואטסאפ נכשלה");
  });

  it("gives null for no reason or an unknown one", () => {
    expect(skipLabel(null)).toBeNull();
    expect(skipLabel("")).toBeNull();
    expect(skipLabel("something_else")).toBeNull();
  });
});
