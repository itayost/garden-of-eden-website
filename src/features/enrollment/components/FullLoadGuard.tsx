"use client";

import { useEffect, useSyncExternalStore } from "react";
import { loadedAsDocument } from "@/lib/security/payment-csp";

const noSubscription = () => () => {};

function isDocumentLoad(): boolean {
  const entry = performance.getEntriesByType("navigation")[0];
  // Without a navigation entry the browser cannot tell; reloading would loop.
  return !entry || loadedAsDocument(entry.name, window.location.pathname);
}

/**
 * Renders the card form only on a document loaded for this page. The card
 * page's enforced CSP comes with its own document load; reached by a
 * client-side navigation (a Link, router.push, a redirect) it would run under
 * the previous page's report-only policy, so the page reloads itself first.
 */
export function FullLoadGuard({ children }: { children: React.ReactNode }) {
  const isReady = useSyncExternalStore(noSubscription, isDocumentLoad, () => false);

  useEffect(() => {
    if (!isDocumentLoad()) window.location.reload();
  }, []);

  if (!isReady) {
    return <p className="py-8 text-center text-sm text-black/60">טוען את טופס התשלום המאובטח...</p>;
  }
  return <>{children}</>;
}
