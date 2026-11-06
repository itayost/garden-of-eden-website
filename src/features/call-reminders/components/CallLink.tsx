"use client";

import type { MouseEvent } from "react";
import { Phone } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatPhoneToLocal } from "@/lib/validations/common";
import { telHref, type CallTarget } from "../lib/rules";
import { startCallAttemptAction } from "../lib/actions/call-attempts";
import { CALL_EVENTS, emitCallEvent } from "../lib/events";

const REMINDER_NOT_SAVED = "התזכורת לתיעוד השיחה לא נשמרה";

interface CallLinkProps {
  readonly target: CallTarget;
  readonly phone: string | null | undefined;
  readonly contactName: string;
  /** "number" shows the phone with an icon; "icon" is a 44px icon-only target. */
  readonly variant?: "number" | "icon";
  readonly className?: string;
}

/**
 * Opens the staff member's own dialer and records the attempt, so a reminder
 * follows 10 minutes later if the call is not documented. The dialer opens
 * whether or not the attempt is saved.
 */
export function CallLink({
  target,
  phone,
  contactName,
  variant = "number",
  className,
}: CallLinkProps) {
  const href = telHref(phone);
  const display = formatPhoneToLocal(phone);

  if (!href) {
    if (variant === "icon") return null;
    return (
      <span dir="ltr" className={cn("text-muted-foreground", className)}>
        {display || "—"}
      </span>
    );
  }

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    // The link sits inside clickable rows; tapping it must not open the row.
    event.stopPropagation();
    startCallAttemptAction(target, contactName)
      .then((result) => {
        if ("error" in result) {
          toast.error(REMINDER_NOT_SAVED, { description: result.error });
          return;
        }
        emitCallEvent(CALL_EVENTS.started);
      })
      .catch(() => toast.error(REMINDER_NOT_SAVED));
  };

  if (variant === "icon") {
    return (
      <a
        href={href}
        onClick={handleClick}
        aria-label={`התקשרות ל${contactName}`}
        className={cn(
          "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
          "bg-emerald-600/10 text-emerald-700 transition-colors",
          "hover:bg-emerald-600/20 active:bg-emerald-600/30",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "dark:text-emerald-400",
          className,
        )}
      >
        <Phone className="h-5 w-5" aria-hidden />
      </a>
    );
  }

  return (
    <a
      href={href}
      onClick={handleClick}
      aria-label={`התקשרות ל${contactName}, ${display}`}
      className={cn(
        "group inline-flex items-center gap-1.5 rounded-md py-0.5 tabular-nums",
        "text-foreground underline-offset-4 hover:underline",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <span
        aria-hidden
        className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-700 transition-colors group-hover:bg-emerald-600/20 dark:text-emerald-400"
      >
        <Phone className="h-3.5 w-3.5" />
      </span>
      <span dir="ltr">{display}</span>
    </a>
  );
}
