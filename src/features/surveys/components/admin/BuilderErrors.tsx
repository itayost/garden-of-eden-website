"use client";

import { useEffect, useRef } from "react";

/**
 * What the server refused, or what still blocks publishing, one line each.
 * It scrolls into view when it appears, since on a phone the buttons that
 * were pressed are far from the top of the page.
 */
export function BuilderErrors({ errors }: { errors: readonly string[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [errors]);

  return (
    <div
      ref={ref}
      role="alert"
      className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"
    >
      <ul className="list-disc space-y-1 ps-5">
        {errors.map((error, index) => (
          <li key={`${index}-${error}`}>{error}</li>
        ))}
      </ul>
    </div>
  );
}
