"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { VideoDataTable } from "./VideoDataTable";
import { VideoForm } from "./VideoForm";
import { DeleteVideoDialog } from "./DeleteVideoDialog";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Pencil, Trash2 } from "lucide-react";
import type { WorkoutVideo } from "@/types/database";

interface VideoListClientProps {
  videos: WorkoutVideo[];
}

/**
 * Client wrapper for video list with edit/delete actions
 * Handles Sheet for editing and refresh on changes
 */
export function VideoListClient({ videos }: VideoListClientProps) {
  const router = useRouter();
  const [editingVideo, setEditingVideo] = useState<WorkoutVideo | null>(null);
  const [editSheetOpen, setEditSheetOpen] = useState(false);

  const handleEditClick = (video: WorkoutVideo) => {
    setEditingVideo(video);
    setEditSheetOpen(true);
  };

  const handleEditSuccess = () => {
    setEditSheetOpen(false);
    setEditingVideo(null);
    router.refresh();
  };

  const handleEditCancel = () => {
    setEditSheetOpen(false);
    setEditingVideo(null);
  };

  const handleDeleteSuccess = () => {
    router.refresh();
  };

  const renderActions = (video: WorkoutVideo) => (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => handleEditClick(video)}
        title="ערוך סרטון"
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <DeleteVideoDialog
        video={video}
        trigger={
          <Button variant="ghost" size="icon" title="מחק סרטון">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        }
        onDeleted={handleDeleteSuccess}
      />
    </div>
  );

  return (
    <>
      <VideoDataTable data={videos} renderActions={renderActions} />

      {/* Edit Sheet */}
      <Sheet open={editSheetOpen} onOpenChange={setEditSheetOpen}>
        <SheetContent side="left" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>עריכת סרטון</SheetTitle>
            <SheetDescription>
              עדכן את פרטי הסרטון
            </SheetDescription>
          </SheetHeader>
          <div className="p-4">
            {editingVideo && (
              <VideoForm
                video={editingVideo}
                onSuccess={handleEditSuccess}
                onCancel={handleEditCancel}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
