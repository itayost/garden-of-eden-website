"use client";

import { MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { buildScheduleWhatsAppText } from "@/lib/utils/schedule-text";
import type { ScheduleSlot } from "@/types/schedule";

interface CopyWhatsAppButtonProps {
  slots: ScheduleSlot[];
}

/**
 * Copies the day as the WhatsApp message the admin used to type by hand.
 * The slots are the source of truth; the message is generated output.
 */
export function CopyWhatsAppButton({ slots }: CopyWhatsAppButtonProps) {
  const handleCopy = async () => {
    const text = buildScheduleWhatsAppText(slots);
    if (!text) {
      toast.error("אין לוח להעתיק");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("הלוח הועתק — אפשר להדביק בוואטסאפ");
    } catch {
      toast.error("ההעתקה נכשלה");
    }
  };

  // Icon-only on a phone: the full label is the widest thing in the header row
  // and would push the primary "סלוט חדש" out of sight.
  return (
    <Button
      variant="outline"
      onClick={handleCopy}
      disabled={slots.length === 0}
      aria-label="העתק כהודעת וואטסאפ"
    >
      <MessageCircle className="h-4 w-4" />
      <span className="hidden sm:inline">העתק כהודעת וואטסאפ</span>
    </Button>
  );
}
