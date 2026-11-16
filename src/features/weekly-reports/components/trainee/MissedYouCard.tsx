import Link from "next/link";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface MissedYouCardProps {
  /** Null when the profile has no name. */
  firstName: string | null;
  /** The Trainee books on the site: the card links to the booking page. */
  canBook: boolean;
}

/** "התגעגענו" on the dashboard, for a week with no training after a recent one. */
export function MissedYouCard({ firstName, canBook }: MissedYouCardProps) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-forest/10 text-forest">
            <Heart className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="text-sm">
            <h2 className="font-bold">{firstName ? `התגעגענו אליך, ${firstName}!` : "התגעגענו אליך!"}</h2>
            <p className="text-muted-foreground">מחכים לראות אותך באימון הבא</p>
          </div>
        </div>
        {canBook && (
          <Button asChild size="sm" className="self-start sm:self-auto">
            <Link href="/dashboard/schedule">לקביעת אימון</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
