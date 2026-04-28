import { CLIP_TTL_DAYS } from "@/lib/api/clip-validation";

export function clipExpiresAt(uploadedAt: string): Date {
  const d = new Date(uploadedAt);
  d.setDate(d.getDate() + CLIP_TTL_DAYS);
  return d;
}

export function clipDaysRemaining(
  uploadedAt: string,
  now: Date = new Date(),
): number {
  const expires = clipExpiresAt(uploadedAt);
  const ms = expires.getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}
