"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";

type ActionResult =
  | { error: string; success?: never }
  | { success: true; error?: never };

interface DeleteConfirmDialogProps {
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  loadingLabel?: string;
  successMessage: string;
  errorMessage: string;
  onDelete: () => Promise<ActionResult>;
  onSuccess?: () => void;
  disabled?: boolean;
  trigger?: React.ReactNode;
}

export function DeleteConfirmDialog({
  title,
  description,
  confirmLabel = "מחק",
  loadingLabel = "מוחק...",
  successMessage,
  errorMessage,
  onDelete,
  onSuccess,
  disabled = false,
  trigger,
}: DeleteConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      const result = await onDelete();

      if (!("success" in result)) {
        toast.error(result.error);
        return;
      }

      toast.success(successMessage);
      setOpen(false);
      onSuccess?.();
    } catch {
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {trigger || (
          <Button variant="destructive" disabled={disabled}>
            <Trash2 className="h-4 w-4 ml-2" />
            {confirmLabel}
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>ביטול</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={loading || disabled}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                {loadingLabel}
              </>
            ) : (
              confirmLabel
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
