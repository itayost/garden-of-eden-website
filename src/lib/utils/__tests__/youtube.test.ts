import { describe, it, expect } from "vitest";
import {
  getYouTubeId,
  getYouTubeThumbnail,
  getYouTubeEmbedUrl,
} from "../youtube";

describe("getYouTubeId", () => {
  it("extracts ID from youtube.com/watch?v=", () => {
    expect(getYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ"
    );
  });

  it("extracts ID from youtube.com/watch?v= with extra params", () => {
    expect(
      getYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120")
    ).toBe("dQw4w9WgXcQ");
  });

  it("extracts ID from youtu.be/", () => {
    expect(getYouTubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts ID from youtube.com/shorts/", () => {
    expect(getYouTubeId("https://youtube.com/shorts/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ"
    );
  });

  it("extracts ID from youtube.com/embed/", () => {
    expect(getYouTubeId("https://youtube.com/embed/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ"
    );
  });

  it("extracts ID from youtu.be/shorts/", () => {
    expect(getYouTubeId("https://youtu.be/shorts/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ"
    );
  });

  it("extracts ID without www prefix", () => {
    expect(getYouTubeId("https://youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ"
    );
  });

  it("handles IDs with hyphens and underscores", () => {
    expect(getYouTubeId("https://youtube.com/watch?v=abc-_123DEf")).toBe(
      "abc-_123DEf"
    );
  });

  it("returns null for invalid URLs", () => {
    expect(getYouTubeId("invalid-url")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(getYouTubeId("")).toBeNull();
  });

  it("returns null for non-YouTube URLs", () => {
    expect(getYouTubeId("https://vimeo.com/12345678")).toBeNull();
  });

  it("returns null for YouTube URL with short ID", () => {
    expect(getYouTubeId("https://youtube.com/watch?v=short")).toBeNull();
  });
});

describe("getYouTubeThumbnail", () => {
  it("returns thumbnail URL with default quality", () => {
    expect(getYouTubeThumbnail("dQw4w9WgXcQ")).toBe(
      "https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg"
    );
  });

  it("returns thumbnail URL with custom quality", () => {
    expect(getYouTubeThumbnail("dQw4w9WgXcQ", "hqdefault")).toBe(
      "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg"
    );
  });

  it("returns thumbnail URL with maxres quality", () => {
    expect(getYouTubeThumbnail("dQw4w9WgXcQ", "maxresdefault")).toBe(
      "https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg"
    );
  });
});

describe("getYouTubeEmbedUrl", () => {
  it("returns embed URL without autoplay", () => {
    expect(getYouTubeEmbedUrl("dQw4w9WgXcQ")).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ"
    );
  });

  it("returns embed URL with autoplay=false explicitly", () => {
    expect(getYouTubeEmbedUrl("dQw4w9WgXcQ", false)).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ"
    );
  });

  it("returns embed URL with autoplay", () => {
    expect(getYouTubeEmbedUrl("dQw4w9WgXcQ", true)).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1"
    );
  });
});
