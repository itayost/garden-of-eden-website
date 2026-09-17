import { describe, expect, it } from "vitest";
import { canAutoplayVideo } from "./video-autoplay";

describe("canAutoplayVideo", () => {
  it("allows autoplay when the visitor has no data or motion preference", () => {
    expect(canAutoplayVideo({ saveData: false, prefersReducedMotion: false })).toBe(true);
  });

  it("blocks autoplay when the visitor asked to save data", () => {
    expect(canAutoplayVideo({ saveData: true, prefersReducedMotion: false })).toBe(false);
  });

  it("blocks autoplay when the visitor prefers reduced motion", () => {
    expect(canAutoplayVideo({ saveData: false, prefersReducedMotion: true })).toBe(false);
  });
});
