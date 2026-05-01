"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import { saveSummary } from "../lib/actions";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/utils/date";

interface ReportSummarySectionProps {
  userId: string;
  initialSummary: string;
  initialUpdatedAt?: string | null;
  onSummaryChange: (summary: string) => void;
}

export function ReportSummarySection({
  userId,
  initialSummary,
  initialUpdatedAt = null,
  onSummaryChange,
}: ReportSummarySectionProps) {
  const [summary, setSummary] = useState(initialSummary);
  const [updatedAt, setUpdatedAt] = useState<string | null>(initialUpdatedAt);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!summary.trim()) return;
    setSaving(true);
    try {
      const { error } = await saveSummary(userId, summary);
      if (error) {
        toast.error(error);
      } else {
        setUpdatedAt(new Date().toISOString());
        toast.success("הסיכום נשמר בהצלחה");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (value: string) => {
    setSummary(value);
    onSummaryChange(value);
  };

  return (
    <Card data-testid="report-summary">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>סיכום / הערות נוספות</CardTitle>
          {updatedAt && (
            <p
              className="text-xs text-muted-foreground mt-1"
              data-testid="summary-updated-at"
            >
              עודכן: {formatDateTime(updatedAt)}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSave}
          disabled={saving || !summary.trim()}
          data-testid="save-summary"
        >
          <Save className="h-4 w-4 ml-2" />
          {saving ? "שומר..." : "שמור סיכום"}
        </Button>
      </CardHeader>
      <CardContent>
        <Textarea
          value={summary}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="כתוב סיכום כללי על השחקן..."
          rows={8}
          className="resize-y"
          data-testid="summary-textarea"
        />
      </CardContent>
    </Card>
  );
}
