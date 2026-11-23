import { describe, expect, it } from "vitest";
import { courseRedirects } from "../course-redirects";

describe("courseRedirects", () => {
  const redirects = courseRedirects();

  it("sends the old digital course address and its lessons to the new one", () => {
    expect(redirects).toContainEqual({
      source: "/dashboard/course",
      destination: "/dashboard/courses/eden-player-development",
      permanent: true,
    });
    expect(redirects).toContainEqual({
      source: "/dashboard/course/:path*",
      destination: "/dashboard/courses/eden-player-development/:path*",
      permanent: true,
    });
  });

  it("sends the old tactical course address and its lessons to the new one", () => {
    expect(redirects).toContainEqual({
      source: "/dashboard/tactical-course",
      destination: "/dashboard/courses/tactical",
      permanent: true,
    });
    expect(redirects).toContainEqual({
      source: "/dashboard/tactical-course/:path*",
      destination: "/dashboard/courses/tactical/:path*",
      permanent: true,
    });
  });

  it("is all permanent and never redirects the new address", () => {
    expect(redirects).toHaveLength(4);
    for (const r of redirects) {
      expect(r.permanent).toBe(true);
      expect(r.source.startsWith("/dashboard/courses")).toBe(false);
    }
  });
});
