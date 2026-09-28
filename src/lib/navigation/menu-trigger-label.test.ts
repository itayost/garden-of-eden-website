import { describe, expect, it } from "vitest";
import { attentionLabel, menuTriggerLabel } from "./menu-trigger-label";

describe("attentionLabel", () => {
  it("uses the singular for one item", () => {
    expect(attentionLabel(1)).toBe("פריט אחד דורש תשומת לב");
  });

  it("uses the plural with the count for several items", () => {
    expect(attentionLabel(3)).toBe("3 פריטים דורשים תשומת לב");
  });
});

describe("menuTriggerLabel", () => {
  it("names the action alone when nothing needs attention", () => {
    expect(menuTriggerLabel(0)).toBe("פתיחת התפריט");
  });

  it("treats a negative count as nothing to report", () => {
    expect(menuTriggerLabel(-2)).toBe("פתיחת התפריט");
  });

  it("uses the singular for one item", () => {
    expect(menuTriggerLabel(1)).toBe("פתיחת התפריט, פריט אחד דורש תשומת לב");
  });

  it("reads the full count for several items", () => {
    expect(menuTriggerLabel(12)).toBe("פתיחת התפריט, 12 פריטים דורשים תשומת לב");
  });
});
