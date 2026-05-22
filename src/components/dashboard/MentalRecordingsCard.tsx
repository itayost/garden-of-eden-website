import { Brain, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Public Google Drive folder ("anyone with the link can view") holding
// recordings of past mental zoom sessions. The ?hl=he tracking param from the
// original share link is intentionally omitted.
const MENTAL_RECORDINGS_DRIVE_URL =
  "https://drive.google.com/drive/folders/1Pl8dGFPfqHY-wZ-AKVdgtuvzhZ4n4WzK";

export function MentalRecordingsCard() {
  return (
    <Card>
      <CardContent className="flex flex-col sm:flex-row sm:items-center gap-4 py-5">
        <div className="flex items-center gap-4 flex-1">
          <div className="bg-indigo-500 rounded-full p-2 shrink-0">
            <Brain className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="font-semibold">הקלטות מפגשי מנטל</h3>
            <p className="text-sm text-muted-foreground">
              צפו בהקלטות ממפגשי הזום הקודמים בנושא מנטליות
            </p>
          </div>
        </div>
        <Button asChild className="shrink-0 self-start sm:self-auto">
          <a
            href={MENTAL_RECORDINGS_DRIVE_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="לצפייה בהקלטות (נפתח בכרטיסייה חדשה)"
          >
            <ExternalLink className="h-4 w-4 me-1" />
            לצפייה בהקלטות
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
