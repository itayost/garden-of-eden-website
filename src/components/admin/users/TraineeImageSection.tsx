"use client";

import { useState } from "react";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { TraineeImageUpload } from "./TraineeImageUpload";
import { updateTraineeAvatarUrls } from "@/lib/actions/admin-images";

interface TraineeImageSectionProps {
  traineeUserId: string;
  traineeName: string;
  currentAvatarUrl: string | null;
}

/**
 * Get initials from a name (up to 2 characters)
 */
function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function TraineeImageSection({
  traineeUserId,
  traineeName,
  currentAvatarUrl,
}: TraineeImageSectionProps) {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUploadSuccess = async (
    originalUrl: string,
    processedUrl: string
  ) => {
    setIsUpdating(true);
    try {
      const result = await updateTraineeAvatarUrls(
        traineeUserId,
        originalUrl,
        processedUrl
      );

      if ("error" in result) {
        toast.error("שגיאה בעדכון התמונה");
        return;
      }

      // Update local state
      setAvatarUrl(originalUrl);
      setIsUploadOpen(false);
      toast.success("תמונת הפרופיל עודכנה בהצלחה");
    } catch (error) {
      console.error("Failed to update avatar:", error);
      toast.error("שגיאה בעדכון התמונה");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = () => {
    setIsUploadOpen(false);
  };

  const hasAvatar = Boolean(avatarUrl);

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Camera className="h-4 w-4" />
            תמונת פרופיל
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {/* Avatar Display */}
          <Avatar className="w-24 h-24">
            <AvatarImage src={avatarUrl ?? undefined} alt={traineeName} />
            <AvatarFallback className="text-xl font-medium">
              {getInitials(traineeName)}
            </AvatarFallback>
          </Avatar>

          {/* Upload Button */}
          <Button
            variant="outline"
            onClick={() => setIsUploadOpen(true)}
            disabled={isUpdating}
          >
            {hasAvatar ? "שנה תמונה" : "הוסף תמונה"}
          </Button>

          {/* Hint text */}
          <p className="text-xs text-muted-foreground text-center">
            התמונה תעבור הסרת רקע אוטומטית לשימוש בכרטיס FIFA
          </p>
        </CardContent>
      </Card>

      {/* Upload Sheet */}
      <Sheet open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <SheetContent side="left" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>העלאת תמונת פרופיל</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <TraineeImageUpload
              traineeUserId={traineeUserId}
              currentAvatarUrl={avatarUrl}
              onSuccess={handleUploadSuccess}
              onCancel={handleCancel}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
