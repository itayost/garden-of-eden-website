"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Phone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  declareNoParentNeededAction,
  dismissParentPromptAction,
  saveParentPhoneAction,
} from "../lib/actions/parent-phone";

type Result = { success: true } | { error: string };

/** Asks a Trainee under 18 for a parent's phone, until they answer or put it off. */
export function ParentPhoneCard({ birthdateKnown }: { birthdateKnown: boolean }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [hidden, setHidden] = useState(false);
  const [pending, startTransition] = useTransition();

  if (hidden) return null;

  const run = (action: () => Promise<Result>, success?: string) =>
    startTransition(async () => {
      const result = await action();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      if (success) toast.success(success);
      setHidden(true);
      router.refresh();
    });

  return (
    <Card>
      <CardContent className="space-y-4 py-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-forest/10 text-forest">
            <Phone className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="text-sm">
            <h2 className="font-bold">מה מספר הטלפון של ההורה?</h2>
            <p className="text-muted-foreground">כדי שנוכל לעדכן את ההורים על ההתקדמות שלך באימונים.</p>
          </div>
        </div>

        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            run(() => saveParentPhoneAction({ phone }), "המספר נשמר, תודה!");
          }}
        >
          <div className="flex-1 space-y-1">
            <Label htmlFor="parent-phone">טלפון של אחד ההורים</Label>
            <Input
              id="parent-phone"
              type="tel"
              inputMode="tel"
              dir="ltr"
              className="h-11 text-right"
              placeholder="0501234567"
              autoComplete="off"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              disabled={pending}
            />
          </div>
          <Button type="submit" className="h-11" disabled={pending || phone.trim() === ""}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            שמירה
          </Button>
        </form>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <button
            type="button"
            className="min-h-10 text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => run(dismissParentPromptAction)}
            disabled={pending}
          >
            לא עכשיו
          </button>
          {!birthdateKnown && (
            <button
              type="button"
              className="min-h-10 text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => run(declareNoParentNeededAction)}
              disabled={pending}
            >
              אני מעל 18
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
