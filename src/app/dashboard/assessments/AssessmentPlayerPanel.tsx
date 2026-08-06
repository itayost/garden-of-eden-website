import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlayerCard } from "@/components/player-card";
import type { PlayerAssessment } from "@/types/assessment";
import type { PlayerPosition } from "@/types/player-stats";

interface Ratings {
  overall_rating: number | null;
  pace: number | null;
  shooting: number | null;
  passing: number | null;
  dribbling: number | null;
  defending: number | null;
  physical: number | null;
}

interface AssessmentPlayerPanelProps {
  fullName: string | null;
  position: string | null;
  avatarUrl: string | null;
  ratings: Ratings | null;
  latestAssessment: PlayerAssessment | null;
  completeness: number | null;
}

/**
 * The player-card side panel of the assessments page — extracted from two
 * identical inline copies. The gold card floats with its own glow instead of
 * sitting inside a white frame that fought it.
 */
export function AssessmentPlayerPanel({
  fullName,
  position,
  avatarUrl,
  ratings,
  latestAssessment,
  completeness,
}: AssessmentPlayerPanelProps) {
  return (
    <div className="hidden space-y-4 lg:block">
      {ratings && (
        <div className="flex justify-center pt-2">
          <PlayerCard
            playerName={fullName || "שחקן"}
            position={(position as PlayerPosition) || "CM"}
            cardType="gold"
            overallRating={ratings.overall_rating}
            stats={{
              pace: ratings.pace,
              shooting: ratings.shooting,
              passing: ratings.passing,
              dribbling: ratings.dribbling,
              defending: ratings.defending,
              physical: ratings.physical,
            }}
            avatarUrl={avatarUrl ?? undefined}
            linkToStats={false}
            size="lg"
          />
        </div>
      )}

      {latestAssessment && (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-sm">מבדק אחרון</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">תאריך</span>
              <span>
                {new Date(latestAssessment.assessment_date).toLocaleDateString("he-IL")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">שלמות</span>
              <Badge variant="outline">{completeness ?? 0}%</Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * Compact mobile strip so phones do not lose the player identity entirely —
 * rating disc, name, and last-assessment date above the tabs.
 */
export function AssessmentPlayerStrip({
  fullName,
  ratings,
  latestAssessment,
}: Pick<AssessmentPlayerPanelProps, "fullName" | "ratings" | "latestAssessment">) {
  if (!ratings) return null;

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-l from-forest to-forest-light px-4 py-3 text-cream lg:hidden">
      <span className="font-display grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gold/20 text-2xl text-gold-light">
        {ratings.overall_rating ?? "—"}
      </span>
      <div className="min-w-0">
        <p className="truncate font-bold">{fullName || "שחקן"}</p>
        {latestAssessment && (
          <p className="text-xs text-cream/70">
            מבדק אחרון:{" "}
            {new Date(latestAssessment.assessment_date).toLocaleDateString("he-IL")}
          </p>
        )}
      </div>
    </div>
  );
}
