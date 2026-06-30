import Link from "next/link";
import { cn } from "@/lib/utils";
import type {
  BookDrill,
  BookDrillCard,
  CardPhase,
  CardMetric,
  FailureStep,
} from "@/features/development-book/lib/types";

// --- Failure Chain ---

interface FailureChainProps {
  steps: FailureStep[];
}

function FailureChain({ steps }: FailureChainProps) {
  if (steps.length === 0) return null;

  return (
    <section aria-labelledby="failure-chain-heading" className="space-y-3">
      <h2
        id="failure-chain-heading"
        className="text-[9px] font-bold tracking-[0.2em] text-amber-500 uppercase"
      >
        שרשרת הכישלון
      </h2>
      <ol className="flex flex-col gap-2">
        {steps.map((step, index) => (
          <li key={step.id} className="flex items-start gap-3">
            <span
              className={cn(
                "shrink-0 mt-0.5 inline-flex items-center justify-center",
                "rounded-full w-5 h-5 text-[10px] font-extrabold",
                step.isFinal
                  ? "bg-red-500/20 text-red-400 border border-red-500/40"
                  : "bg-muted text-muted-foreground border border-border"
              )}
              aria-hidden="true"
            >
              {index + 1}
            </span>
            <span
              className={cn(
                "text-sm leading-relaxed",
                step.isFinal ? "text-red-400 font-semibold" : "text-muted-foreground"
              )}
            >
              {step.textHe}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

// --- Phase Card ---

interface PhaseCardProps {
  phase: CardPhase;
}

function PhaseCard({ phase }: PhaseCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Phase header */}
      <div className="flex items-start gap-4 px-4 py-3 border-b border-border bg-muted/30">
        {phase.number !== null && (
          <span className="text-2xl font-black text-amber-500 leading-none shrink-0 tabular-nums">
            {String(phase.number).padStart(2, "0")}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-bold text-sm text-foreground leading-tight">{phase.nameHe}</p>
          {phase.subtitleHe && (
            <p className="text-[11px] text-muted-foreground mt-0.5">{phase.subtitleHe}</p>
          )}
        </div>
      </div>

      {/* Phase body */}
      {phase.points.length > 0 && (
        <div className="px-4 py-3 space-y-2">
          <ul className="flex flex-col gap-2">
            {phase.points.map((point) => (
              <li key={point.id} className="flex items-start gap-2">
                <span
                  className="shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full bg-primary"
                  aria-hidden="true"
                />
                <span className="text-xs text-muted-foreground leading-relaxed">
                  {point.textHe}
                </span>
              </li>
            ))}
          </ul>

          {phase.drillNoteHe && (
            <div className="mt-3 rounded-lg bg-primary/8 border border-primary/15 px-3 py-2">
              <p className="text-[11px] text-primary leading-relaxed">{phase.drillNoteHe}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Metrics Table ---

interface MetricsTableProps {
  metrics: CardMetric[];
}

function MetricsTable({ metrics }: MetricsTableProps) {
  if (metrics.length === 0) return null;

  return (
    <section aria-labelledby="metrics-heading" className="space-y-3">
      <h2
        id="metrics-heading"
        className="text-[9px] font-bold tracking-[0.2em] text-amber-500 uppercase"
      >
        מדדי הצלחה — 6 שבועות
      </h2>
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="px-3 py-2.5 text-start font-bold text-muted-foreground">מדד</th>
              <th className="px-3 py-2.5 text-start font-bold text-muted-foreground">לפני</th>
              <th className="px-3 py-2.5 text-start font-bold text-amber-500">יעד</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((metric, index) => (
              <tr
                key={metric.id}
                className={cn(
                  "border-b border-border last:border-b-0",
                  index % 2 === 0 ? "bg-card" : "bg-muted/20"
                )}
              >
                <td className="px-3 py-2.5 font-semibold text-foreground">{metric.labelHe}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{metric.beforeHe ?? "—"}</td>
                <td className="px-3 py-2.5 text-amber-500 font-semibold">
                  {metric.targetHe ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// --- Premium Card View ---

interface PremiumCardProps {
  drill: BookDrill;
  card: BookDrillCard;
}

function PremiumCard({ drill, card }: PremiumCardProps) {
  return (
    <article className="space-y-6" dir="rtl">
      {/* Back nav */}
      <div>
        <Link
          href="/dashboard/book"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← ספר פיתוח שחקן
        </Link>
      </div>

      {/* Card header */}
      <header className="space-y-1">
        {card.situationLabelHe && (
          <p className="text-[9px] font-bold tracking-[0.2em] text-amber-500 uppercase">
            {card.situationLabelHe}
          </p>
        )}
        <h1 className="text-2xl font-black text-foreground leading-tight">
          {drill.nameHe ?? drill.nameEn ?? "תרגיל"}
        </h1>
        {card.subtitleHe && (
          <p className="text-sm text-muted-foreground leading-relaxed">{card.subtitleHe}</p>
        )}

        {/* Meta badges */}
        {(card.ageMinLabel || card.levelLabel) && (
          <div className="flex flex-wrap gap-2 pt-1">
            {card.ageMinLabel && (
              <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold bg-muted text-muted-foreground border border-border">
                {card.ageMinLabel}
              </span>
            )}
            {card.levelLabel && (
              <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                {card.levelLabel}
              </span>
            )}
          </div>
        )}
      </header>

      {/* Failure chain */}
      {card.failureSteps.length > 0 && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <FailureChain steps={card.failureSteps} />
        </div>
      )}

      {/* Training protocol phases */}
      {card.phases.length > 0 && (
        <section aria-labelledby="protocol-heading" className="space-y-3">
          <h2 id="protocol-heading" className="text-base font-extrabold text-foreground">
            פרוטוקול האימון — {card.phases.length} שלבים
          </h2>
          <div className="flex flex-col gap-3">
            {card.phases.map((phase) => (
              <PhaseCard key={phase.id} phase={phase} />
            ))}
          </div>
        </section>
      )}

      {/* Golden rule */}
      {card.goldenRuleHe && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/8 p-5 text-center">
          <p className="text-[9px] font-bold tracking-[0.2em] text-amber-500 uppercase mb-2">
            חוק הזהב — Garden of Eden
          </p>
          <blockquote className="text-base font-bold text-amber-400 leading-relaxed">
            {card.goldenRuleHe}
          </blockquote>
        </div>
      )}

      {/* Metrics table */}
      <MetricsTable metrics={card.metrics} />
    </article>
  );
}

// --- Basic Drill Fallback View ---

interface BasicDrillViewProps {
  drill: BookDrill;
}

function BasicDrillView({ drill }: BasicDrillViewProps) {
  return (
    <article className="space-y-5" dir="rtl">
      {/* Back nav */}
      <div>
        <Link
          href="/dashboard/book"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← ספר פיתוח שחקן
        </Link>
      </div>

      {/* Header */}
      <header className="space-y-1">
        <h1 className="text-2xl font-black text-foreground leading-tight">
          {drill.nameHe ?? drill.nameEn ?? "תרגיל"}
        </h1>
        {(drill.muscles.length > 0 || drill.muscleHe || drill.setsHe) && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {drill.muscles.length > 0
              ? drill.muscles.map((m) => (
                  <span
                    key={m.id}
                    className="inline-flex rounded px-2 py-0.5 text-[10px] font-bold bg-primary/10 text-primary"
                  >
                    {m.emoji ? `${m.emoji} ${m.nameHe}` : m.nameHe}
                  </span>
                ))
              : drill.muscleHe && (
                  <span className="inline-flex rounded px-2 py-0.5 text-[10px] font-bold bg-primary/10 text-primary">
                    {drill.muscleHe}
                  </span>
                )}
            {drill.setsHe && (
              <span className="inline-flex rounded px-2 py-0.5 text-[10px] font-bold bg-amber-400/10 text-amber-600 dark:text-amber-400">
                {drill.setsHe}
              </span>
            )}
          </div>
        )}
      </header>

      {/* Content */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        {drill.howHe && (
          <div className="space-y-1">
            <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
              איך
            </p>
            <p className="text-sm text-foreground leading-relaxed">{drill.howHe}</p>
          </div>
        )}

        {drill.whyHe && (
          <div className="space-y-1 border-t border-border pt-4">
            <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
              למה
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">{drill.whyHe}</p>
          </div>
        )}

        {drill.connectHe && (
          <div className="space-y-1 border-t border-border pt-4">
            <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
              קשר למשחק
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">{drill.connectHe}</p>
          </div>
        )}
      </div>

      {/* Coming soon note */}
      <div className="rounded-lg border border-dashed border-border px-4 py-3 text-center">
        <p className="text-xs text-muted-foreground">כרטיס מפורט בקרוב</p>
      </div>
    </article>
  );
}

// --- Public export ---

interface DrillCardProps {
  drill: BookDrill;
  card: BookDrillCard | null;
}

export function DrillCard({ drill, card }: DrillCardProps) {
  if (card !== null) {
    return <PremiumCard drill={drill} card={card} />;
  }
  return <BasicDrillView drill={drill} />;
}
