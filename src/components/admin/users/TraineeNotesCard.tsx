"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  StickyNote,
  AlertCircle,
  Calendar,
  UserCircle,
  ChevronDown,
  ChevronUp,
  Trash2,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  getTraineeNotes,
  deleteTraineeNote,
  editTraineeNote,
} from "@/lib/actions/admin-user-notes";
import { DeleteConfirmDialog } from "@/components/admin/DeleteConfirmDialog";
import {
  NOTE_CATEGORY_LABELS,
  type TraineeReportNotes,
  type NoteCategoryType,
} from "@/lib/utils/trainee-notes";

interface TraineeNotesCardProps {
  traineeId: string;
  currentUserId: string;
  isAdmin: boolean;
}

const CATEGORY_COLORS: Record<NoteCategoryType, string> = {
  new_trainee: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  discipline: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  injuries: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  limitations: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  worked_on: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
  achievements: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  mental_state: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
  complaints: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  insufficient_attention: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  pro_candidates: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  social_skills: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  homework: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
  video_feedback: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  praise: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
};

const INITIAL_VISIBLE_COUNT = 5;

export function TraineeNotesCard({
  traineeId,
  currentUserId,
  isAdmin,
}: TraineeNotesCardProps) {
  const [notes, setNotes] = useState<readonly TraineeReportNotes[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [editingNote, setEditingNote] = useState<{
    reportId: string;
    type: NoteCategoryType;
  } | null>(null);
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchNotes() {
      setLoading(true);
      const result = await getTraineeNotes(traineeId);
      if (result.error) {
        setError(result.error);
      } else {
        setNotes(result.data);
      }
      setLoading(false);
    }
    fetchNotes();
  }, [traineeId]);

  const visibleNotes = showAll ? notes : notes.slice(0, INITIAL_VISIBLE_COUNT);
  const hasMore = notes.length > INITIAL_VISIBLE_COUNT;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("he-IL", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const canEditReport = (trainerId: string) =>
    isAdmin || trainerId === currentUserId;

  const handleDeleteSuccess = (reportId: string, noteType: NoteCategoryType) => {
    setNotes((prev) => {
      const updated = prev.map((report) => {
        if (report.reportId !== reportId) return report;
        return {
          ...report,
          notes: report.notes.filter((n) => n.type !== noteType),
        };
      });
      // Remove reports with no remaining notes
      return updated.filter((report) => report.notes.length > 0);
    });
  };

  const handleStartEdit = (reportId: string, noteType: NoteCategoryType, currentDetails: string | null) => {
    setEditingNote({ reportId, type: noteType });
    setEditText(currentDetails ?? "");
  };

  const handleCancelEdit = () => {
    setEditingNote(null);
    setEditText("");
  };

  const handleSaveEdit = async () => {
    if (!editingNote) return;
    setSaving(true);
    try {
      const result = await editTraineeNote(
        editingNote.reportId,
        traineeId,
        editingNote.type,
        editText,
      );
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      // Update local state
      setNotes((prev) =>
        prev.map((report) => {
          if (report.reportId !== editingNote.reportId) return report;
          return {
            ...report,
            notes: report.notes.map((n) =>
              n.type === editingNote.type
                ? { ...n, details: editText.trim() || null }
                : n,
            ),
          };
        }),
      );
      toast.success("ההערה עודכנה בהצלחה");
      setEditingNote(null);
      setEditText("");
    } catch {
      toast.error("שגיאה בעריכת ההערה");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <StickyNote className="h-5 w-5" />
          הערות מאמנים
          {!loading && notes.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {notes.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="text-center py-6 text-muted-foreground">
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-muted rounded w-3/4 mx-auto" />
              <div className="h-4 bg-muted rounded w-1/2 mx-auto" />
            </div>
          </div>
        )}

        {error && (
          <div className="text-center py-6 text-destructive">
            <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {!loading && !error && notes.length === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <StickyNote className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">אין הערות עדיין</p>
          </div>
        )}

        {!loading && !error && notes.length > 0 && (
          <div className="space-y-4">
            {visibleNotes.map((report) => (
              <div
                key={report.reportId}
                className="border rounded-lg p-3 space-y-2"
              >
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDate(report.reportDate)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <UserCircle className="h-3.5 w-3.5" />
                    {report.trainerName}
                  </span>
                </div>

                <div className="space-y-2">
                  {report.notes.map((note, idx) => {
                    const isEditing =
                      editingNote?.reportId === report.reportId &&
                      editingNote?.type === note.type;
                    const showActions = canEditReport(report.trainerId);

                    return (
                      <div key={`${note.type}-${idx}`} className="space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[note.type]}`}
                            >
                              {NOTE_CATEGORY_LABELS[note.type]}
                            </span>
                            {note.achievementCategories?.map((cat) => (
                              <Badge
                                key={cat}
                                variant="outline"
                                className="text-xs"
                              >
                                {cat}
                              </Badge>
                            ))}
                          </div>

                          {showActions && !isEditing && (
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() =>
                                  handleStartEdit(
                                    report.reportId,
                                    note.type,
                                    note.details,
                                  )
                                }
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <DeleteConfirmDialog
                                title="מחיקת הערה"
                                description="האם למחוק הערה זו? לא ניתן לשחזר פעולה זו."
                                successMessage="ההערה נמחקה בהצלחה"
                                errorMessage="שגיאה במחיקת ההערה"
                                onDelete={() =>
                                  deleteTraineeNote(
                                    report.reportId,
                                    traineeId,
                                    note.type,
                                  )
                                }
                                onSuccess={() =>
                                  handleDeleteSuccess(report.reportId, note.type)
                                }
                                trigger={
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                }
                              />
                            </div>
                          )}
                        </div>

                        {isEditing ? (
                          <div className="space-y-2">
                            <Textarea
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              className="text-sm min-h-[60px]"
                              dir="rtl"
                            />
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                onClick={handleSaveEdit}
                                disabled={saving}
                              >
                                <Check className="h-3.5 w-3.5 ml-1" />
                                {saving ? "שומר..." : "שמור"}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={handleCancelEdit}
                                disabled={saving}
                              >
                                <X className="h-3.5 w-3.5 ml-1" />
                                ביטול
                              </Button>
                            </div>
                          </div>
                        ) : (
                          note.details && (
                            <p className="text-sm text-foreground/80 pr-1">
                              {note.details}
                            </p>
                          )
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {hasMore && (
              <button
                type="button"
                onClick={() => setShowAll((prev) => !prev)}
                className="w-full flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
              >
                {showAll ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    הצג פחות
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    הצג את כל ההערות ({notes.length})
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
