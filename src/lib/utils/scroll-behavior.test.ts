import { describe, expect, it } from "vitest";
import { scrollBehaviorFor } from "./scroll-behavior";

describe("scrollBehaviorFor", () => {
  it("scrolls smoothly when the visitor has no motion preference", () => {
    expect(scrollBehaviorFor(false)).toBe("smooth");
  });

  it("jumps instantly when the visitor prefers reduced motion", () => {
    expect(scrollBehaviorFor(true)).toBe("auto");
  });
});
