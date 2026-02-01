import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Video, Clock, ExternalLink } from "lucide-react";
import type { WorkoutVideo } from "@/types/database";

const dayTopics: Record<number, string> = {
  1: "גמישות ויציבות",
  2: "כוח רגליים",
  3: "זריזות וקואורדינציה",
  4: "סיבולת לב-ריאה",
  5: "שיקום והתאוששות",
};

export default async function AdminVideosPage() {
  const supabase = await createClient();

  const { data: videos } = await supabase
    .from("workout_videos")
    .select("*")
    .order("day_number")
    .order("order_index") as { data: WorkoutVideo[] | null };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">ניהול סרטונים</h1>
        <p className="text-muted-foreground">
          צפייה וניהול סרטוני התרגילים במערכת
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            רשימת סרטונים ({videos?.length || 0})
          </CardTitle>
          <CardDescription>
            כל סרטוני התרגילים לבית - 5 ימים, כל יום נושא אחר
          </CardDescription>
        </CardHeader>
        <CardContent>
          {videos && videos.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>יום</TableHead>
                    <TableHead>נושא</TableHead>
                    <TableHead>כותרת</TableHead>
                    <TableHead>משך</TableHead>
                    <TableHead>קישור</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {videos.map((video) => (
                    <TableRow key={video.id}>
                      <TableCell>
                        <Badge variant="outline">יום {video.day_number}</Badge>
                      </TableCell>
                      <TableCell>{video.day_topic || dayTopics[video.day_number]}</TableCell>
                      <TableCell className="font-medium">{video.title}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          {video.duration_minutes} דקות
                        </div>
                      </TableCell>
                      <TableCell>
                        <a
                          href={video.youtube_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                          צפייה
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Video className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>אין סרטונים במערכת עדיין</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-muted/50">
        <CardContent className="py-6">
          <div className="flex items-start gap-4">
            <div className="bg-primary/10 rounded-xl p-3">
              <Video className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold mb-2">הוספת סרטונים</h3>
              <p className="text-muted-foreground text-sm">
                להוספת סרטונים חדשים, יש להוסיף אותם ישירות לטבלת workout_videos בסופאבייס.
                כל סרטון צריך לכלול: מספר יום (1-5), נושא היום, כותרת, קישור YouTube, משך בדקות וסדר הצגה.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
