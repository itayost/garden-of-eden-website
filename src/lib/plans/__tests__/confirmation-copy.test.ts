import { describe, expect, it } from "vitest";
import { startSentence, validityText } from "../confirmation-copy";

describe("validityText", () => {
  it("is the end date alone for a Plan that starts today or is not in the queue", () => {
    expect(validityText({ kind: "today" }, "2026-11-30")).toBe("30/11/2026");
    expect(validityText(null, "2026-11-30")).toBe("30/11/2026");
  });

  it("adds the start in brackets for a Plan that waits in the queue", () => {
    expect(validityText({ kind: "on", date: "2026-11-01" }, "2026-11-30")).toBe("30/11/2026 (מתחיל ב-01/11/2026)");
    expect(validityText({ kind: "after_card", latest: "2026-11-19" }, "2026-12-27")).toBe(
      "27/12/2026 (מתחיל בסיום הכרטיסייה הנוכחית)",
    );
  });
});

describe("startSentence", () => {
  it("tells the parent on the success page when the Plan starts", () => {
    expect(startSentence({ kind: "today" })).toBe("המסלול מתחיל היום.");
    expect(startSentence({ kind: "on", date: "2026-11-01" })).toBe("המסלול מתחיל ב-01/11/2026, אחרי המסלול הנוכחי.");
    expect(startSentence({ kind: "after_card", latest: "2026-11-19" })).toBe(
      "המסלול יתחיל בסיום הכרטיסייה הנוכחית, לכל המאוחר ב-19/11/2026.",
    );
  });
});
