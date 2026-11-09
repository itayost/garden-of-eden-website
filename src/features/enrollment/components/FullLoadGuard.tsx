"use client";

import { useEffect } from "react";
import { loadedAsDocument } from "@/lib/security/payment-csp";

function isDocumentLoad(): boolean {
  const entry = performance.getEntriesByType("navigation")[0];
  // Without a navigation entry the browser cannot tell; reloading would loop.
  return !entry || loadedAsDocument(entry.name, window.location.pathname);
}

/**
 * Keeps the card page under its own enforced CSP. That policy comes with the
 * page's own document load; reached by a client-side navigation (a Link,
 * router.push, a redirect) the page would run under the previous page's
 * report-only policy, so it reloads itself. The children always render, on
 * the server too, so Pelecard's frame is in the page's HTML source.
 */
export function FullLoadGuard({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!isDocumentLoad()) window.location.reload();
  }, []);

  return <>{children}</>;
}
