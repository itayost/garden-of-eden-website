import { describe, expect, it } from "vitest";
import { isPaymentPagePath, loadedAsDocument, paymentPageCsp } from "../payment-csp";

function directives(csp: string): Map<string, string> {
  return new Map(
    csp
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [name, ...values] = part.split(/\s+/);
        return [name, values.join(" ")] as const;
      }),
  );
}

describe("paymentPageCsp", () => {
  it("allows only scripts carrying this request's nonce, and what they load", () => {
    const csp = directives(paymentPageCsp("abc123", { dev: false }));
    const scripts = csp.get("script-src") ?? "";
    expect(scripts).toContain("'nonce-abc123'");
    expect(scripts).toContain("'strict-dynamic'");
    expect(scripts).not.toContain("'unsafe-inline'");
    expect(scripts).not.toContain("'unsafe-eval'");
  });

  it("allows eval only in development, where React needs it", () => {
    const csp = directives(paymentPageCsp("abc123", { dev: true }));
    expect(csp.get("script-src")).toContain("'unsafe-eval'");
  });

  it("keeps card data from leaving for another origin", () => {
    const csp = directives(paymentPageCsp("abc123", { dev: false }));
    expect(csp.get("form-action")).toBe("'self'");
    expect(csp.get("connect-src")?.split(" ")).not.toContain("*");
    expect(csp.get("base-uri")).toBe("'self'");
    expect(csp.get("object-src")).toBe("'none'");
    expect(csp.get("frame-ancestors")).toBe("'none'");
  });

  it("lets the site's own service worker register", () => {
    const csp = directives(paymentPageCsp("abc123", { dev: false }));
    expect(csp.get("worker-src")).toBe("'self'");
  });
});

describe("isPaymentPagePath", () => {
  it("matches the card page only", () => {
    expect(isPaymentPagePath("/join/pay/3f2b8c1e-9a4d-4e21-b7c6-0d5e8f9a1b2c")).toBe(true);
    expect(isPaymentPagePath("/join/pay")).toBe(true);
    expect(isPaymentPagePath("/join")).toBe(false);
    expect(isPaymentPagePath("/join/payment-terms")).toBe(false);
    expect(isPaymentPagePath("/admin/orders")).toBe(false);
  });
});

describe("loadedAsDocument", () => {
  const PAY = "/join/pay/3f2b8c1e-9a4d-4e21-b7c6-0d5e8f9a1b2c";

  it("is true when the document itself was loaded for the card page", () => {
    expect(loadedAsDocument(`https://www.edengarden.co.il${PAY}`, PAY)).toBe(true);
    expect(loadedAsDocument(`https://www.edengarden.co.il${PAY}?x=1`, PAY)).toBe(true);
  });

  it("is false after a client-side navigation from another page", () => {
    expect(loadedAsDocument("https://www.edengarden.co.il/join", PAY)).toBe(false);
  });

  it("is false when the browser gives no navigation entry", () => {
    expect(loadedAsDocument(undefined, PAY)).toBe(false);
    expect(loadedAsDocument("not a url", PAY)).toBe(false);
  });
});
