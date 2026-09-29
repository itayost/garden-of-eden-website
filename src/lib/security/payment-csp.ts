/**
 * The enforced Content-Security-Policy for the card page. Card numbers are
 * typed on our own page and sent to our server, so any injected script there
 * could read them. Only scripts carrying this request's nonce run, plus what
 * they load ('strict-dynamic'), and nothing may be sent to another origin.
 * The rest of the site keeps the report-only policy in next.config.ts.
 *
 * Styles stay 'unsafe-inline': Tailwind and Framer Motion write inline
 * styles, and a style cannot read a form field.
 */

const PAYMENT_PAGE_PREFIX = "/join/pay";

export function isPaymentPagePath(pathname: string): boolean {
  return pathname === PAYMENT_PAGE_PREFIX || pathname.startsWith(`${PAYMENT_PAGE_PREFIX}/`);
}

/**
 * Whether the current document was loaded for this path, rather than reached
 * by a client-side navigation from another page, which keeps that page's
 * policy. `documentUrl` is the navigation timing entry's URL. Next strips its
 * navigation headers before middleware, so only the browser can tell.
 */
export function loadedAsDocument(documentUrl: string | undefined, pathname: string): boolean {
  if (!documentUrl) return false;
  try {
    return new URL(documentUrl).pathname === pathname;
  } catch {
    return false;
  }
}

export function paymentPageCsp(nonce: string, { dev }: { dev: boolean }): string {
  const scripts = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(dev ? ["'unsafe-eval'"] : [])];
  return [
    "default-src 'self'",
    `script-src ${scripts.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${dev ? " ws:" : ""}`,
    // The root layout registers /sw.js; under 'strict-dynamic' workers need their own source.
    "worker-src 'self'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
  ].join("; ");
}
