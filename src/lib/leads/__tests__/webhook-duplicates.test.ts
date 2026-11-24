import { describe, expect, it } from "vitest";
import { webhookLeadVerdict } from "../webhook-duplicates";

const PAID = "tab-paid";
const GK = "tab-gk";

describe("webhookLeadVerdict", () => {
  it("adds a new phone and sends the flow", () => {
    expect(webhookLeadVerdict({ slug: "paid", targetTabId: PAID, existing: [] })).toEqual({
      duplicateOf: null,
      sendFlow: true,
    });
  });

  it("refuses a phone already in any tab for the ad tab", () => {
    expect(
      webhookLeadVerdict({ slug: "paid", targetTabId: PAID, existing: [{ id: "a", tab_id: GK }] }),
    ).toEqual({ duplicateOf: "a", sendFlow: false });
  });

  it("refuses a phone already in any tab when no slug is sent", () => {
    expect(
      webhookLeadVerdict({ slug: null, targetTabId: PAID, existing: [{ id: "a", tab_id: "other" }] }),
    ).toEqual({ duplicateOf: "a", sendFlow: false });
  });

  it("adds a goalkeeper lead whose phone is only in another tab, without a second flow", () => {
    expect(
      webhookLeadVerdict({
        slug: "goalkeepers",
        targetTabId: GK,
        existing: [{ id: "a", tab_id: PAID }],
      }),
    ).toEqual({ duplicateOf: null, sendFlow: false });
  });

  it("refuses a goalkeeper lead already in the goalkeepers tab", () => {
    expect(
      webhookLeadVerdict({
        slug: "goalkeepers",
        targetTabId: GK,
        existing: [
          { id: "a", tab_id: PAID },
          { id: "b", tab_id: GK },
        ],
      }),
    ).toEqual({ duplicateOf: "b", sendFlow: false });
  });

  it("sends the flow to a brand new goalkeeper lead", () => {
    expect(webhookLeadVerdict({ slug: "goalkeepers", targetTabId: GK, existing: [] })).toEqual({
      duplicateOf: null,
      sendFlow: true,
    });
  });
});
