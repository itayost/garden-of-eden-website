"use client";

import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { LEAD_STATUS_LABELS } from "@/types/leads";
import type { Lead } from "@/types/leads";

interface LeadExportButtonProps {
  leads: Lead[];
  variant?: "default" | "outline" | "secondary" | "ghost";
}

export function LeadExportButton({
  leads,
  variant = "outline",
}: LeadExportButtonProps) {
  const handleExport = () => {
    if (leads.length === 0) {
      toast.error("אין נתונים לייצוא");
      return;
    }

    const csvData = leads.map((lead) => ({
      שם: lead.name,
      טלפון: formatPhone(lead.phone),
      סטטוס: LEAD_STATUS_LABELS[lead.status],
      מחיפה: lead.is_from_haifa ? "כן" : "לא",
      הערה: lead.note || "",
      תשלום: lead.payment ?? "",
      חודשים: lead.months ?? "",
      'סה"כ תשלום': lead.total_payment ?? "",
      "קבוצת גיל": lead.flow_age_group || "",
      קבוצה: lead.flow_team || "",
      תדירות: lead.flow_frequency || "",
      "תאריך יצירה": new Date(lead.created_at).toLocaleDateString("he-IL"),
      "עדכון אחרון": new Date(lead.updated_at).toLocaleDateString("he-IL"),
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `לידים-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success(`יוצאו ${leads.length} לידים`);
  };

  return (
    <Button
      variant={variant}
      onClick={handleExport}
      disabled={leads.length === 0}
    >
      <Download className="h-4 w-4 ml-2" />
      ייצוא ל-CSV ({leads.length})
    </Button>
  );
}

function formatPhone(phone: string): string {
  if (phone.startsWith("972")) return "0" + phone.slice(3);
  return phone;
}
