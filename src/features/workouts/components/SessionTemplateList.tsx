"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DeleteConfirmDialog } from "@/components/admin/DeleteConfirmDialog";
import {
  deleteTemplateAction,
  duplicateTemplateAction,
} from "@/lib/actions/session-templates";
import { formatDate } from "@/lib/utils/date";
import type { SessionTemplateSummary } from "@/types/session-template";

interface TemplateCardProps {
  template: SessionTemplateSummary;
  onRefresh: () => void;
}

function TemplateCard({ template, onRefresh }: TemplateCardProps) {
  const [duplicating, startDuplicate] = useTransition();

  const handleDuplicate = () => {
    startDuplicate(async () => {
      const result = await duplicateTemplateAction(template.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("התבנית שוכפלה");
      onRefresh();
    });
  };

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
      <div className="min-w-0 flex-1">
        <Link
          href={`/admin/workouts/templates/${template.id}`}
          className="block truncate text-base font-semibold text-primary hover:underline"
        >
          {template.name}
        </Link>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {template.exerciseCount} תרגילים · {template.createdByName} ·{" "}
          {formatDate(template.updatedAt)}
        </p>
        {template.description && (
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {template.description}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDuplicate}
          disabled={duplicating}
          aria-label="שכפל תבנית"
        >
          {duplicating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          <span className="ms-1 hidden sm:inline">שכפל</span>
        </Button>

        <DeleteConfirmDialog
          title={`מחיקת תבנית: ${template.name}`}
          description="פעולה זו תמחק את התבנית לצמיתות. אימונים שנבנו ממנה בעבר לא יושפעו."
          successMessage="התבנית נמחקה"
          errorMessage="שגיאה במחיקת התבנית"
          onDelete={() => deleteTemplateAction(template.id)}
          onSuccess={onRefresh}
          trigger={
            <Button variant="ghost" size="sm" aria-label="מחק תבנית">
              <span className="text-sm text-destructive">מחק</span>
            </Button>
          }
        />
      </div>
    </div>
  );
}

interface SessionTemplateListProps {
  templates: SessionTemplateSummary[];
}

/**
 * The templates tab.
 *
 * There is no "new template" button on purpose: a template is born from a real
 * session a trainer composed for a real trainee, via "שמירה כתבנית" in the
 * session builder. Starting from an empty form here would just be a second,
 * worse builder.
 */
export function SessionTemplateList({ templates }: SessionTemplateListProps) {
  const router = useRouter();
  const refresh = () => router.refresh();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">{templates.length} תבניות</p>
      </div>

      {templates.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <p>אין תבניות אימון עדיין.</p>
          <p className="mt-1 text-sm">
            בנה אימון למתאמן בלוח היומי ולחץ &quot;שמירה כתבנית&quot; כדי ליצור אחת.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onRefresh={refresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}
