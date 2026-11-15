import { describe, expect, it } from "vitest";
import { planConfirmedText, templateMissing, waShareUrl } from "../share";

describe("waShareUrl", () => {
  it("opens a chat with the number, without the plus, and the text encoded", () => {
    expect(waShareUrl("+972521234567", "שלום עולם")).toBe(`https://wa.me/972521234567?text=${encodeURIComponent("שלום עולם")}`);
  });
});

describe("planConfirmedText", () => {
  it("says what the approved template says: who, which plan, until when, and the agreement link", () => {
    const text = planConfirmedText({
      parentName: "רונית",
      childName: "דני",
      planName: "כרטיסייה 10",
      validity: "9.1.2027",
      agreementUrl: "https://www.edengarden.co.il/join/agreement/x?t=y",
      branchName: "קריית אתא",
    });
    expect(text).toContain("רונית");
    expect(text).toContain("דני");
    expect(text).toContain("כרטיסייה 10");
    expect(text).toContain("בתוקף עד 9.1.2027");
    expect(text).toContain("https://www.edengarden.co.il/join/agreement/x?t=y");
  });

  it("names the branch the Plan was sold at, or none when it is unknown", () => {
    const base = { parentName: "רונית", childName: "דני", planName: "ללא הגבלה", validity: "", agreementUrl: "https://x" };
    expect(planConfirmedText({ ...base, branchName: "חיפה" })).toContain("בגארדן אוף עדן חיפה נקלט");
    expect(planConfirmedText({ ...base, branchName: null })).toContain("בגארדן אוף עדן נקלט");
  });
});

describe("templateMissing", () => {
  it("recognizes a template not yet set (waiting for Meta), and nothing else", () => {
    expect(templateMissing({ success: false, error: "WHATSAPP_PLAN_CONFIRMED_TEMPLATE_NAME not configured" })).toBe(true);
    expect(templateMissing({ success: false, error: "rate limited" })).toBe(false);
    expect(templateMissing({ success: true })).toBe(false);
    expect(templateMissing(null)).toBe(false);
  });
});
