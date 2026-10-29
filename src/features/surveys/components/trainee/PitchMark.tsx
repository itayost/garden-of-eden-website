import { cn } from "@/lib/utils";

/**
 * A football centre circle, faint in a corner: one ring, the centre spot and
 * the halfway line, in lime at about 10% opacity. Decorative, so it is hidden
 * from assistive technology and never takes a tap. The parent clips it
 * (overflow-hidden) and puts its content above it with `relative`.
 */
export function PitchMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 360 360"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute -top-[120px] -end-[150px] size-[360px] text-brand-lime opacity-10",
        className,
      )}
    >
      <circle cx="180" cy="180" r="120" />
      <circle cx="180" cy="180" r="6" fill="currentColor" />
      <path d="M0 180H360" />
    </svg>
  );
}
