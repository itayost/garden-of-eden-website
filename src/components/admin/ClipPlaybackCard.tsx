import { Film } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getClipWithSignedUrlForAdmin } from "@/features/clips/lib/actions/clips";
import { clipDaysRemaining } from "@/features/clips/lib/clip-time";

interface ClipPlaybackCardProps {
  userId: string;
}

export async function ClipPlaybackCard({ userId }: ClipPlaybackCardProps) {
  const result = await getClipWithSignedUrlForAdmin(userId);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Film className="h-4 w-4" />
          הסרטון של השחקן
        </CardTitle>
      </CardHeader>
      <CardContent>
        {result?.signedUrl ? (
          <div className="space-y-3">
            <video
              controls
              preload="metadata"
              className="w-full rounded-lg bg-black"
              src={result.signedUrl}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                נותרו {clipDaysRemaining(result.clip.uploaded_at)} ימים
              </Badge>
              <span className="text-xs text-muted-foreground">
                הועלה ב-{new Date(result.clip.uploaded_at).toLocaleDateString("he-IL")}
              </span>
            </div>
          </div>
        ) : result ? (
          <p className="text-sm text-muted-foreground">לא ניתן לטעון את הסרטון כעת</p>
        ) : (
          <p className="text-sm text-muted-foreground">השחקן לא העלה סרטון</p>
        )}
      </CardContent>
    </Card>
  );
}
