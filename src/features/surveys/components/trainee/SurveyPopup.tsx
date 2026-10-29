"use client";

import { useRef } from "react";

import { Dialog } from "@/components/ui/dialog";
import { SheetDialogContent } from "@/components/ui/sheet-dialog";
import type { OfferableSurvey } from "../../lib/types";
import { PitchMark } from "./PitchMark";
import { SHEET_TEXT } from "./sheet-styles";
import { SurveyFlow } from "./SurveyFlow";

export interface SurveyPopupProps {
  survey: OfferableSurvey;
  firstName: string;
  /** Preview shows every screen and sends nothing; the builder uses it. */
  mode: "live" | "preview";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once the answers are saved, after the router refresh is requested. */
  onSent?: () => void;
}

/**
 * A Survey as a game moment: a forest-green bottom sheet on a phone, a centered
 * dialog from sm up, with the faint centre circle in its corner. The screens
 * live in SurveyFlow, inside the content, so each opening starts from the intro.
 *
 * The built-in close button is replaced by one inside the header row, so the
 * level path can sit between "back" and "close". Escape, a tap outside, that
 * button and "אחר כך" all end in `onOpenChange(false)`, except while a send is
 * in flight: closing then would snooze a Survey whose send may still fail and
 * lose the answers, so those requests are ignored until the send ends.
 *
 * `--ring` is set to lime here because the app's focus outline reads from it
 * and the default green is too dark on the forest sheet.
 */
export function SurveyPopup({ survey, firstName, mode, open, onOpenChange, onSent }: SurveyPopupProps) {
  const sendingRef = useRef(false);
  const requestOpenChange = (next: boolean) => {
    if (!next && sendingRef.current) return;
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={requestOpenChange}>
      <SheetDialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className={`${SHEET_TEXT} [--ring:#CDEA68] rounded-t-[28px] border-0 bg-forest shadow-[0_-18px_40px_-12px_rgb(0_0_0/0.55)] sm:rounded-3xl sm:shadow-[0_40px_80px_-30px_rgb(0_0_0/0.6)]`}
      >
        <PitchMark />
        <SurveyFlow
          survey={survey}
          firstName={firstName}
          mode={mode}
          onClose={() => requestOpenChange(false)}
          onSent={onSent}
          onSendingChange={(sending) => {
            sendingRef.current = sending;
          }}
        />
      </SheetDialogContent>
    </Dialog>
  );
}
