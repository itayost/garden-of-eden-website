import { describe, expect, it } from "vitest";
import { isPerTabCampaign, webhookLeadVerdict } from "../webhook-duplicates";

const PAID = "tab-paid";
const GK = "tab-gk";

describe("isPerTabCampaign", () => {
  it("keeps the any-tab rule for the ad tab and for no slug", () => {
    expect(isPerTabCampaign({ slug: "paid", byName: false })).toBe(false);
    expect(isPerTabCampaign({ slug: null, byName: false })).toBe(false);
  });

  it("checks only the own tab for a campaign slug or a tab found by name", () => {
    expect(isPerTabCampaign({ slug: "goalkeepers", byName: false })).toBe(true);
    expect(isPerTabCampaign({ slug: null, byName: true })).toBe(true);
  });
});

describe("webhookLeadVerdict", () => {
  it("adds a new phone and sends the flow", () => {
    expect(webhookLeadVerdict({ perTab: false, targetTabId: PAID, existing: [] })).toEqual({
      duplicateOf: null,
      sendFlow: true,
    });
  });

  it("refuses a phone already in any tab under the ad rule", () => {
    expect(
      webhookLeadVerdict({ perTab: false, targetTabId: PAID, existing: [{ id: "a", tab_id: GK }] }),
    ).toEqual({ duplicateOf: "a", sendFlow: false });
  });

  it("adds a campaign lead whose phone is only in another tab, without a second flow", () => {
    expect(
      webhookLeadVerdict({ perTab: true, targetTabId: GK, existing: [{ id: "a", tab_id: PAID }] }),
    ).toEqual({ duplicateOf: null, sendFlow: false });
  });

  it("refuses a campaign lead already in its own tab", () => {
    expect(
      webhookLeadVerdict({
        perTab: true,
        targetTabId: GK,
        existing: [
          { id: "a", tab_id: PAID },
          { id: "b", tab_id: GK },
        ],
      }),
    ).toEqual({ duplicateOf: "b", sendFlow: false });
  });

  it("sends the flow to a brand new campaign lead", () => {
    expect(webhookLeadVerdict({ perTab: true, targetTabId: GK, existing: [] })).toEqual({
      duplicateOf: null,
      sendFlow: true,
    });
  });
});
