import { describe, it, expect } from "vitest";
import {
  validateClipFile,
  buildClipPath,
  getClipExtension,
  MAX_CLIP_SIZE,
} from "../clip-validation";

function makeFile(name: string, type: string, size: number): File {
  const blob = new Blob([new Uint8Array(size)], { type });
  return new File([blob], name, { type });
}

describe("validateClipFile", () => {
  it("accepts an MP4 within the size limit", () => {
    const file = makeFile("clip.mp4", "video/mp4", 5 * 1024 * 1024);
    expect(validateClipFile(file).valid).toBe(true);
  });

  it("accepts a MOV within the size limit", () => {
    const file = makeFile("clip.mov", "video/quicktime", 5 * 1024 * 1024);
    expect(validateClipFile(file).valid).toBe(true);
  });

  it("rejects a missing file", () => {
    const result = validateClipFile(null);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain("לא נשלח");
    }
  });

  it("rejects an unsupported MIME type", () => {
    const file = makeFile("clip.png", "image/png", 1024);
    const result = validateClipFile(file);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain("פורמט");
    }
  });

  it("rejects a clip larger than the cap", () => {
    const file = makeFile("clip.mp4", "video/mp4", MAX_CLIP_SIZE + 1);
    const result = validateClipFile(file);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain("גדול");
    }
  });
});

describe("getClipExtension", () => {
  it("maps known MIME types", () => {
    expect(getClipExtension("video/mp4")).toBe("mp4");
    expect(getClipExtension("video/quicktime")).toBe("mov");
  });

  it("falls back to mp4 for unknown MIME", () => {
    expect(getClipExtension("video/unknown")).toBe("mp4");
  });
});

describe("buildClipPath", () => {
  it("places the file inside the user's folder", () => {
    const path = buildClipPath("user-1", "video/mp4");
    expect(path.startsWith("user-1/")).toBe(true);
    expect(path.endsWith(".mp4")).toBe(true);
  });

  it("uses the right extension for MOV", () => {
    const path = buildClipPath("user-1", "video/quicktime");
    expect(path.endsWith(".mov")).toBe(true);
  });
});
