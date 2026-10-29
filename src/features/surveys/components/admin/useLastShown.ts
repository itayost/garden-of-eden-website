import { useState } from "react";

/**
 * The value, or the last one that was not null. A sheet holds its content
 * through the closing animation, which would otherwise play on an empty panel.
 */
export function useLastShown<T>(value: T | null): T | null {
  const [last, setLast] = useState<T | null>(value);
  if (value !== null && value !== last) setLast(value);
  return value ?? last;
}
