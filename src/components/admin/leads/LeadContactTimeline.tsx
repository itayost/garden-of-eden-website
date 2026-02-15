"use client";

import { Phone, MessageCircle, Users, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  LEAD_CONTACT_TYPE_LABELS,
  LEAD_OUTCOME_LABELS,
  type LeadContactLog,
  type LeadContactType,
} from "@/types/leads";

interface LeadContactTimelineProps {
  entries: LeadContactLog[];
}

const contactTypeIcons: Record<LeadContactType, React.ReactNode> = {
  call: <Phone className="h-4 w-4" />,
  whatsapp: <MessageCircle className="h-4 w-4" />,
  meeting: <Users className="h-4 w-4" />,
  message_sent: <Send className="h-4 w-4" />,
};

function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function LeadContactTimeline({ entries }: LeadContactTimelineProps) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        אין רישומי יצירת קשר
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="flex gap-3 p-3 rounded-lg border bg-muted/30"
        >
          <div className="flex-shrink-0 mt-0.5 text-muted-foreground">
            {contactTypeIcons[entry.contact_type]}
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">
                {LEAD_CONTACT_TYPE_LABELS[entry.contact_type]}
              </span>
              {entry.outcome && (
                <Badge variant="outline" className="text-xs">
                  {LEAD_OUTCOME_LABELS[entry.outcome]}
                </Badge>
              )}
              {entry.rep && (
                <span className="text-xs text-muted-foreground">
                  נציג: {entry.rep}
                </span>
              )}
            </div>
            {entry.notes && (
              <p className="text-sm text-muted-foreground">{entry.notes}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {formatDateTime(entry.created_at)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
