/**
 * profiles.phone is stored in three spellings across the table (+972..., 972...,
 * 05...), see the phone-format memory. A lookup by phone must try all three
 * until the canonicalization lands.
 */
export function phoneVariants(e164: string): string[] {
  const match = /^\+972(\d{9})$/.exec(e164);
  if (!match) return [e164];
  const rest = match[1];
  return [e164, `972${rest}`, `0${rest}`];
}
