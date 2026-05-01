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
import { Check, Loader2, UserMinus } from "lucide-react";

interface MoveToChurnedButtonProps {
  readonly traineeName: string;
  readonly endDate: string;
  readonly alreadyMoved: boolean;
  readonly onConfirm: () => Promise<void>;
}

export function MoveToChurnedButton({
  traineeName,
  endDate,
  alreadyMoved,
  onConfirm,
}: MoveToChurnedButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  if (alreadyMoved) {
    return (
      <Button
        size="sm"
        variant="outline"
        disabled
        className="gap-1.5 text-muted-foreground"
      >
        <Check className="h-3.5 w-3.5" />
        הועבר
      </Button>
    );
  }

  if (!endDate) {
    return (
      <Button
        size="sm"
        variant="outline"
        disabled
        title="אין תאריך סיום"
        className="gap-1.5"
      >
        <UserMinus className="h-3.5 w-3.5" />
        העבר
      </Button>
    );
  }

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <UserMinus className="h-3.5 w-3.5" />
          העבר
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>להעביר ללקוחות שעזבו?</AlertDialogTitle>
          <AlertDialogDescription>
            הרשומה של <span className="font-semibold">{traineeName}</span> תועתק
            לטאב &ldquo;לקוחות שעזבו&rdquo; כולל תאריך הסיום וההערה. ניתן יהיה
            לערוך או למחוק אותה משם.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>ביטול</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 ms-2 animate-spin" />
                מעביר...
              </>
            ) : (
              "העבר"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
