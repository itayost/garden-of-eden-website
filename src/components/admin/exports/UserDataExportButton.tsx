"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DatabaseZap, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { exportUserDataAction } from "@/lib/actions/admin-gdpr";

interface UserDataExportButtonProps {
  /** User ID to export data for */
  userId: string;
  /** User's display name for filename and toast */
  userName: string;
}

/**
 * Button to export all user data for GDPR compliance
 *
 * Downloads a JSON file containing:
 * - Profile data
 * - Form submissions (pre_workout, post_workout, nutrition)
 * - Assessments (excluding soft-deleted)
 * - Video progress
 *
 * Excludes per CONTEXT.md:
 * - Activity logs
 * - Payment history
 * - Goals
 * - Achievements
 */
export function UserDataExportButton({
  userId,
  userName,
}: UserDataExportButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const result = await exportUserDataAction(userId);

      if (!("success" in result)) {
        toast.error(result.error);
        return;
      }

      // Create JSON blob and download
      const jsonContent = JSON.stringify(result.data, null, 2);
      const blob = new Blob([jsonContent], { type: "application/json" });

      // Create download link with sanitized filename
      const sanitizedName = userName.replace(/\s+/g, "-").replace(/[^\w\u0590-\u05FF-]/g, "");
      const dateStr = new Date().toISOString().split("T")[0];
      const filename = `gdpr-export-${sanitizedName}-${dateStr}.json`;

      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);

      // Summary toast showing record counts
      const { data } = result;
      const totalRecords =
        data.preWorkoutForms.length +
        data.postWorkoutForms.length +
        data.nutritionForms.length +
        data.assessments.length +
        data.videoProgress.length;

      toast.success(`יוצאו ${totalRecords} רשומות עבור ${userName}`);
    } catch (error) {
      console.error("GDPR export error:", error);
      toast.error("שגיאה בייצוא הנתונים");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleExport} variant="outline" disabled={loading}>
      {loading ? (
        <Loader2 className="h-4 w-4 ml-2 animate-spin" />
      ) : (
        <DatabaseZap className="h-4 w-4 ml-2" />
      )}
      {loading ? "מייצא..." : "ייצוא נתונים (GDPR)"}
    </Button>
  );
}
