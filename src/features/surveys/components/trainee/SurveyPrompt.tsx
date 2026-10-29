"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { israelToday } from "@/lib/utils/tasks";
import { isSnoozed, surveyPromptAllowedOn } from "../../lib/offer";
import { browserStorage, readSnooze, writeSnooze } from "../../lib/snooze-storage";
import type { OfferableSurvey } from "../../lib/types";
import { recordSeen } from "./record-seen";
import { SurveyPopup } from "./SurveyPopup";

interface SurveyPromptProps {
  survey: OfferableSurvey | null;
  firstName: string;
}

/** Waiting for a page where it may show, showing, or finished with until the next full page load. */
type Phase = "waiting" | "open" | "done";

/**
 * Opens the Survey popup on its own, once per full page load of the trainee
 * area, on pages where the Trainee is not mid-activity and unless they closed
 * it without sending today on this device.
 *
 * It keeps the Survey it was first given. After a send the popup refreshes the
 * router and the layout hands down the next Survey; that one must wait for the
 * next full page load, so later props are ignored.
 */
export function SurveyPrompt({ survey, firstName }: SurveyPromptProps) {
  const pathname = usePathname();
  const [offered] = useState(survey);
  const [phase, setPhase] = useState<Phase>("waiting");
  const sentRef = useRef(false);
  const seenRef = useRef(false);

  useEffect(() => {
    if (phase !== "waiting" || offered === null || !surveyPromptAllowedOn(pathname)) return;
    if (isSnoozed(readSnooze(browserStorage(), offered.id), israelToday())) return;
    // The storage read has to wait for the browser, so the decision to open is
    // made here, once, rather than during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhase("open");
    if (!seenRef.current) {
      seenRef.current = true;
      recordSeen(offered.id);
    }
  }, [offered, pathname, phase]);

  if (offered === null) return null;

  const handleOpenChange = (open: boolean) => {
    if (open) return;
    setPhase("done");
    // "Later" hides it until tomorrow; a Survey that was just sent needs no snooze.
    if (!sentRef.current) writeSnooze(browserStorage(), offered.id, israelToday());
  };

  return (
    <SurveyPopup
      survey={offered}
      firstName={firstName}
      mode="live"
      open={phase === "open"}
      onOpenChange={handleOpenChange}
      onSent={() => {
        sentRef.current = true;
      }}
    />
  );
}
