"use client";

import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";
import type { Profile } from "@/types/database";

interface UserExportButtonProps {
  /** Users to export (should be the current filtered view) */
  users: Profile[];
  /** Optional button variant */
  variant?: "default" | "outline" | "secondary" | "ghost";
}

/**
 * Button to export users to CSV with Hebrew column names
 *
 * Includes BOM (Byte Order Mark) for proper Hebrew display in Excel
 */
export function UserExportButton({ users, variant = "outline" }: UserExportButtonProps) {
  const handleExport = () => {
    if (users.length === 0) {
      toast.error("אין נתונים לייצוא");
      return;
    }

    // Transform users to export format with Hebrew column names
    const csvData = users.map((user) => ({
      "שם": user.full_name || "",
      "טלפון": formatPhoneForExport(user.phone),
      "תפקיד": roleToHebrew(user.role),
      "סטטוס": user.is_active ? "פעיל" : "לא פעיל",
      "תאריך הצטרפות": formatDate(user.created_at),
    }));

    // Generate CSV with Papa.unparse
    const csv = Papa.unparse(csvData);

    // Create blob with BOM for Hebrew support in Excel
    // \uFEFF is the UTF-8 BOM character
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });

    // Create download link
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `משתמשים-${formatDateForFilename(new Date())}.csv`;
    link.click();

    // Cleanup
    URL.revokeObjectURL(link.href);

    toast.success(`יוצאו ${users.length} משתמשים`);
  };

  return (
    <Button variant={variant} onClick={handleExport} disabled={users.length === 0}>
      <Download className="h-4 w-4 ml-2" />
      ייצוא ל-CSV ({users.length})
    </Button>
  );
}

/**
 * Format phone number for export
 * Convert +972 format back to 0XX format for easier reading
 */
function formatPhoneForExport(phone: string | null): string {
  if (!phone) return "";

  // Convert +972501234567 to 0501234567
  if (phone.startsWith("+972")) {
    return "0" + phone.slice(4);
  }

  return phone;
}

/**
 * Convert role to Hebrew display name
 */
function roleToHebrew(role: string): string {
  switch (role) {
    case "admin":
      return "מנהל";
    case "trainer":
      return "מאמן";
    case "trainee":
    default:
      return "מתאמן";
  }
}

/**
 * Format date for display in CSV
 */
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("he-IL");
}

/**
 * Format date for filename (YYYY-MM-DD)
 */
function formatDateForFilename(date: Date): string {
  return date.toISOString().split("T")[0];
}
