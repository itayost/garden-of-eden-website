"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Play, Clock, CheckCircle2 } from "lucide-react";
import type { WorkoutVideo } from "@/types/database";

interface VideoCardProps {
  video: WorkoutVideo;
  watched: boolean;
}

export function VideoCard({ video, watched: initialWatched }: VideoCardProps) {
  const [watched, setWatched] = useState(initialWatched);
  const [open, setOpen] = useState(false);

  const markAsWatched = async () => {
    if (watched) return;

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return;

    const { error } = await (supabase.from("video_progress") as unknown as {
      upsert: (data: Record<string, unknown>) => Promise<{ error: Error | null }>
    }).upsert({
      user_id: user.id,
      video_id: video.id,
      watched: true,
      watched_at: new Date().toISOString(),
    });

    if (!error) {
      setWatched(true);
    }
  };

  // Extract YouTube video ID from URL
  const getYouTubeId = (url: string) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
    return match ? match[1] : null;
  };

  const youtubeId = getYouTubeId(video.youtube_url);

  return (
    <Card className={`overflow-hidden ${watched ? "bg-green-50/50 border-green-200" : ""}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Thumbnail / Play Button */}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <button
                className="relative flex-shrink-0 w-32 h-20 bg-muted rounded-lg overflow-hidden group"
                onClick={() => markAsWatched()}
              >
                {youtubeId ? (
                  <img
                    src={`https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`}
                    alt={video.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-primary/10">
                    <Play className="h-8 w-8 text-primary" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="bg-white rounded-full p-2">
                    <Play className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl p-0">
              <DialogHeader className="p-4 pb-0">
                <DialogTitle>{video.title}</DialogTitle>
              </DialogHeader>
              <div className="aspect-video">
                {youtubeId ? (
                  <iframe
                    width="100%"
                    height="100%"
                    src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1`}
                    title={video.title}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted">
                    <p className="text-muted-foreground">סרטון לא זמין</p>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Info */}
          <div className="flex-grow">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold">{video.title}</h3>
              {watched && (
                <Badge variant="secondary" className="bg-green-100 text-green-700 flex-shrink-0">
                  <CheckCircle2 className="h-3 w-3 ml-1" />
                  נצפה
                </Badge>
              )}
            </div>
            {video.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {video.description}
              </p>
            )}
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{video.duration_minutes} דקות</span>
              </div>
            </div>
          </div>
        </div>

        {!watched && (
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-4"
            onClick={() => {
              markAsWatched();
              setOpen(true);
            }}
          >
            <Play className="h-4 w-4 ml-2" />
            צפייה בסרטון
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
