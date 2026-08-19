import { progressPercent } from "@/features/course/lib/progress-utils";

interface CourseProgressRingProps {
  done: number;
  total: number;
  /** Diameter in pixels. */
  size?: number;
}

const STROKE = 4;

/**
 * Completion ring for the course header.
 *
 * Drawn with a rotated SVG rather than a CSS conic gradient so the sweep
 * direction stays the same in RTL — a conic gradient mirrors with the document
 * and would run counter-clockwise here.
 */
export function CourseProgressRing({
  done,
  total,
  size = 56,
}: CourseProgressRingProps) {
  const percent = progressPercent(done, total);
  const radius = (size - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);

  return (
    <div
      className="relative grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`הושלמו ${done} מתוך ${total} שיעורים`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE}
          className="text-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="text-primary transition-[stroke-dashoffset] duration-500 motion-reduce:transition-none"
        />
      </svg>
      <span className="absolute text-sm font-bold tabular-nums text-primary">
        {percent}%
      </span>
    </div>
  );
}
