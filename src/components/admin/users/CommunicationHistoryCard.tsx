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
  MessageSquare,
  AlertCircle,
  Calendar,
  UserCircle,
  ChevronDown,
  ChevronUp,
  Trash2,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import {
  getCommunicationNotes,
  addCommunicationNote,
  deleteCommunicationNote,
  type CommunicationNote,
} from "@/lib/actions/trainee-communication-log";
import { DeleteConfirmDialog } from "@/components/admin/DeleteConfirmDialog";
import { formatDateTime } from "@/lib/utils/date";
import { MAX_NOTE_LENGTH } from "@/lib/validations/communication-log";

interface CommunicationHistoryCardProps {
  traineeId: string;
  currentUserId: string;
  isAdmin: boolean;
}

const INITIAL_VISIBLE_COUNT = 5;

export function CommunicationHistoryCard({
  traineeId,
  currentUserId,
  isAdmin,
}: CommunicationHistoryCardProps) {
  const [notes, setNotes] = useState<readonly CommunicationNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function fetchNotes() {
      setLoading(true);
      const result = await getCommunicationNotes(traineeId);
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
  const trimmedContent = content.trim();
  const canSubmit = !submitting && trimmedContent.length > 0;

  const canDelete = (authorId: string) => isAdmin || authorId === currentUserId;

  const handleAdd = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const result = await addCommunicationNote(traineeId, trimmedContent);
      if (result.error || !result.data) {
        toast.error(result.error ?? "שגיאה בשמירת ההערה");
        return;
      }
      setNotes((prev) => [result.data!, ...prev]);
      setContent("");
      toast.success("ההערה נוספה בהצלחה");
    } catch {
      toast.error("שגיאה בשמירת ההערה");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSuccess = (noteId: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          היסטוריית תקשורת
          {!loading && notes.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {notes.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add note form */}
        <div className="space-y-2">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="תיעוד שיחה, פנייה או אירוע מול המתאמן..."
            className="min-h-[80px]"
            dir="rtl"
            maxLength={MAX_NOTE_LENGTH}
            disabled={submitting}
          />
          <div className="flex justify-end">
            <Button onClick={handleAdd} disabled={!canSubmit}>
              <Send className="h-4 w-4 me-1" />
              {submitting ? "שומר..." : "הוסף הערה"}
            </Button>
          </div>
        </div>

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
            <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">אין תיעוד תקשורת עדיין</p>
          </div>
        )}

        {!loading && !error && notes.length > 0 && (
          <div className="space-y-4">
            {visibleNotes.map((note) => (
              <div key={note.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <UserCircle className="h-3.5 w-3.5" />
                    {note.author_name}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDateTime(note.created_at)}
                  </span>
                </div>

                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-foreground/90 whitespace-pre-wrap min-w-0">
                    {note.content}
                  </p>
                  {canDelete(note.author_id) && (
                    <DeleteConfirmDialog
                      title="מחיקת הערה"
                      description="האם למחוק הערה זו? לא ניתן לשחזר פעולה זו."
                      successMessage="ההערה נמחקה בהצלחה"
                      errorMessage="שגיאה במחיקת ההערה"
                      onDelete={() => deleteCommunicationNote(note.id, traineeId)}
                      onSuccess={() => handleDeleteSuccess(note.id)}
                      trigger={
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      }
                    />
                  )}
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
