import { describe, it, expect } from "vitest";
import { getSafeRedirectUrl } from "../redirect";

describe("getSafeRedirectUrl", () => {
  it("returns default for null", () => {
    expect(getSafeRedirectUrl(null)).toBe("/dashboard");
  });

  it("returns default for undefined (cast to null)", () => {
    expect(getSafeRedirectUrl(undefined as unknown as null)).toBe("/dashboard");
  });

  it("returns default for empty string", () => {
    expect(getSafeRedirectUrl("")).toBe("/dashboard");
  });

  it("allows valid relative paths", () => {
    expect(getSafeRedirectUrl("/dashboard")).toBe("/dashboard");
    expect(getSafeRedirectUrl("/admin/users")).toBe("/admin/users");
    expect(getSafeRedirectUrl("/auth/callback")).toBe("/auth/callback");
  });

  it("allows root path", () => {
    expect(getSafeRedirectUrl("/")).toBe("/");
  });

  it("allows paths with query params", () => {
    expect(getSafeRedirectUrl("/dashboard?tab=overview")).toBe(
      "/dashboard?tab=overview"
    );
  });

  it("allows paths with hash fragments", () => {
    expect(getSafeRedirectUrl("/page#section")).toBe("/page#section");
  });

  it("blocks protocol-relative URLs", () => {
    expect(getSafeRedirectUrl("//evil.com")).toBe("/dashboard");
    expect(getSafeRedirectUrl("//evil.com/path")).toBe("/dashboard");
  });

  it("blocks absolute URLs", () => {
    expect(getSafeRedirectUrl("https://evil.com")).toBe("/dashboard");
    expect(getSafeRedirectUrl("http://evil.com")).toBe("/dashboard");
  });

  it("blocks javascript: protocol", () => {
    expect(getSafeRedirectUrl("javascript:alert(1)")).toBe("/dashboard");
  });

  it("blocks URLs with colon in path", () => {
    expect(getSafeRedirectUrl("/foo:bar")).toBe("/dashboard");
  });

  it("blocks URLs not starting with /", () => {
    expect(getSafeRedirectUrl("dashboard")).toBe("/dashboard");
    expect(getSafeRedirectUrl("evil.com")).toBe("/dashboard");
  });

  it("uses custom default URL", () => {
    expect(getSafeRedirectUrl(null, "/auth/login")).toBe("/auth/login");
    expect(getSafeRedirectUrl("https://evil.com", "/home")).toBe("/home");
  });
});
