# Phase 4: Data Export & Assessment Management - Research

**Researched:** 2026-02-01
**Domain:** CSV/PDF export, soft delete with audit, GDPR data export, RTL document generation
**Confidence:** HIGH

## Summary

This phase adds export functionality for form submissions, assessments, and user data, plus admin ability to delete assessments with audit trail. The project already has established patterns from Phase 2 for CSV export (PapaParse with UTF-8 BOM for Hebrew), TanStack Table for admin views, and soft delete infrastructure from Phase 1.

The standard approach uses:
- **PapaParse** (already installed) for CSV export with UTF-8 BOM for Hebrew Excel compatibility
- **react-day-picker + date-fns** for date range filtering (shadcn/ui Calendar pattern)
- **@react-pdf/renderer** for PDF generation with custom Hebrew fonts
- **Existing soft delete pattern** from Phase 1, extended with `deleted_by` column

**Primary recommendation:** Follow Phase 2's CSV export pattern exactly. For PDF, use @react-pdf/renderer with RTL workarounds since Puppeteer/Playwright would require server infrastructure changes. Add `deleted_by` column to player_assessments for audit trail. Use native HTML date inputs for simple date filtering (avoiding calendar component complexity).

## Standard Stack

### Core (Already Installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `papaparse` | ^5.5.3 | CSV generation | Already installed, proven Hebrew support with BOM |
| `@tanstack/react-table` | ^8.21.3 | Data tables | Already installed, Phase 2/3 patterns established |
| `sonner` | ^2.0.7 | Toast notifications | Already installed |
| `zod` | ^4.2.1 | Validation | Already installed |

### New Dependencies Required

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@react-pdf/renderer` | ^4.x | PDF generation | Assessment PDF reports with branding |
| `react-day-picker` | ^9.x | Date picker | Date range filtering for exports |
| `date-fns` | ^4.x | Date utilities | Date formatting, manipulation |

### Installation

```bash
npm install @react-pdf/renderer react-day-picker date-fns
```

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @react-pdf/renderer | Puppeteer/Playwright | Server-side, perfect RTL, but requires infra changes |
| @react-pdf/renderer | jsPDF | Lower-level API, RTL issues with AutoTable |
| react-day-picker | Native HTML date input | Simpler, less polish, but works for MVP |
| date-fns | dayjs/moment | date-fns is shadcn/ui default, better tree-shaking |

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/admin/
│   ├── submissions/
│   │   ├── page.tsx              # Add export button, date filter
│   │   └── export/               # Export utilities
│   └── assessments/
│       └── [userId]/
│           └── page.tsx          # Add delete button
├── components/admin/
│   ├── exports/
│   │   ├── SubmissionExportButton.tsx    # Form submissions export
│   │   ├── AssessmentExportButton.tsx    # Assessments to CSV
│   │   ├── AssessmentPdfButton.tsx       # Assessments to PDF
│   │   ├── UserDataExportButton.tsx      # GDPR per-user export
│   │   └── DateRangeFilter.tsx           # Date filter component
│   ├── assessments/
│   │   └── DeleteAssessmentDialog.tsx    # Delete with confirmation
│   └── users/
│       └── UserExportButton.tsx          # Already exists (reference)
├── lib/
│   ├── actions/
│   │   └── admin-assessments.ts          # Soft delete server action
│   └── exports/
│       ├── csv-utils.ts                  # Shared CSV export utilities
│       ├── pdf-assessment-template.tsx   # PDF template component
│       └── gdpr-export.ts                # GDPR data aggregation
└── types/
    └── database.ts                       # Add deleted_by to assessments
```

### Pattern 1: CSV Export with Hebrew Support (ESTABLISHED)

**What:** Export data to CSV with UTF-8 BOM for Hebrew display in Excel
**When to use:** All CSV exports
**Source:** Existing `UserExportButton.tsx`

```typescript
// Source: src/components/admin/users/UserExportButton.tsx
import Papa from "papaparse";

function exportToCSV(data: Record<string, unknown>[], filename: string) {
  // Generate CSV with Papa.unparse
  const csv = Papa.unparse(data);

  // Create blob with BOM for Hebrew support in Excel
  // \uFEFF is the UTF-8 BOM character
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });

  // Create download link
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();

  // Cleanup
  URL.revokeObjectURL(link.href);
}

// Usage with Hebrew column names
const csvData = submissions.map((s) => ({
  "שם מלא": s.full_name,
  "תאריך הגשה": formatDateHebrew(s.submitted_at),
  // ... more fields
}));

exportToCSV(csvData, `שאלונים-${formatDateForFilename(new Date())}.csv`);
```

### Pattern 2: Date Range Filter for Exports

**What:** Filter data by date range before export
**When to use:** Form submissions export
**Source:** shadcn/ui Calendar + react-day-picker

```typescript
// Simple approach using native HTML date inputs (per CONTEXT.md: simple date picker)
// Source: Existing pattern in post-workout form

interface DateRangeFilterProps {
  startDate: string;
  endDate: string;
  onStartChange: (date: string) => void;
  onEndChange: (date: string) => void;
}

function DateRangeFilter({ startDate, endDate, onStartChange, onEndChange }: DateRangeFilterProps) {
  return (
    <div className="flex gap-4 items-center">
      <div>
        <Label htmlFor="start-date">מתאריך</Label>
        <Input
          id="start-date"
          type="date"
          value={startDate}
          onChange={(e) => onStartChange(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="end-date">עד תאריך</Label>
        <Input
          id="end-date"
          type="date"
          value={endDate}
          onChange={(e) => onEndChange(e.target.value)}
        />
      </div>
    </div>
  );
}
```

### Pattern 3: Soft Delete with Audit Trail

**What:** Set `deleted_at` and `deleted_by` instead of hard delete
**When to use:** Assessment deletion
**Source:** Phase 1 soft delete pattern + CONTEXT.md requirement

```typescript
// Server action for assessment deletion
"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function softDeleteAssessmentAction(assessmentId: string) {
  // 1. Verify admin
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (adminProfile?.role !== "admin") {
    return { error: "Admin access required" };
  }

  // 2. Soft delete with audit
  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("player_assessments")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: user.id,
    })
    .eq("id", assessmentId);

  if (error) {
    return { error: error.message };
  }

  // 3. Log activity
  const { data: assessment } = await adminClient
    .from("player_assessments")
    .select("user_id")
    .eq("id", assessmentId)
    .single();

  await adminClient.from("activity_logs").insert({
    user_id: assessment?.user_id || assessmentId,
    action: "assessment_deleted",
    actor_id: user.id,
    actor_name: adminProfile.full_name,
    metadata: { assessment_id: assessmentId },
  });

  revalidatePath("/admin/assessments");
  return { success: true };
}
```

### Pattern 4: PDF Generation with @react-pdf/renderer

**What:** Generate branded PDF reports with RTL Hebrew support
**When to use:** Assessment PDF export
**Source:** @react-pdf/renderer docs + RTL workarounds

```typescript
// src/lib/exports/pdf-assessment-template.tsx
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Image,
} from "@react-pdf/renderer";

// Register Hebrew font (must be hosted or bundled)
Font.register({
  family: "Heebo",
  fonts: [
    { src: "/fonts/Heebo-Regular.ttf", fontWeight: 400 },
    { src: "/fonts/Heebo-Bold.ttf", fontWeight: 700 },
  ],
});

const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#FFFFFF",
    padding: 30,
    fontFamily: "Heebo",
  },
  header: {
    flexDirection: "row-reverse", // RTL workaround
    justifyContent: "space-between",
    marginBottom: 20,
    borderBottom: 1,
    borderBottomColor: "#E5E7EB",
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    textAlign: "right",
  },
  table: {
    display: "flex",
    flexDirection: "column",
    marginTop: 20,
  },
  tableRow: {
    flexDirection: "row-reverse", // RTL workaround
    borderBottom: 1,
    borderBottomColor: "#E5E7EB",
    paddingVertical: 8,
  },
  tableCell: {
    flex: 1,
    textAlign: "right",
    fontSize: 11,
  },
  tableCellHeader: {
    flex: 1,
    textAlign: "right",
    fontSize: 11,
    fontWeight: 700,
    backgroundColor: "#F3F4F6",
  },
});

interface AssessmentPdfProps {
  playerName: string;
  assessments: PlayerAssessment[];
  brandingLogo: string;
}

export function AssessmentPdfDocument({
  playerName,
  assessments,
  brandingLogo,
}: AssessmentPdfProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header with branding */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>דוח מבדקים</Text>
            <Text style={{ textAlign: "right" }}>{playerName}</Text>
          </View>
          <Image src={brandingLogo} style={{ width: 100 }} />
        </View>

        {/* Data table */}
        <View style={styles.table}>
          {/* Header row */}
          <View style={styles.tableRow}>
            <Text style={styles.tableCellHeader}>תאריך</Text>
            <Text style={styles.tableCellHeader}>ספרינט 5מ</Text>
            <Text style={styles.tableCellHeader}>ספרינט 10מ</Text>
            {/* ... more columns */}
          </View>

          {/* Data rows */}
          {assessments.map((assessment) => (
            <View key={assessment.id} style={styles.tableRow}>
              <Text style={styles.tableCell}>
                {formatDateHebrew(assessment.assessment_date)}
              </Text>
              <Text style={styles.tableCell}>
                {assessment.sprint_5m ?? "---"}
              </Text>
              {/* ... more cells */}
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}
```

### Pattern 5: GDPR Data Export

**What:** Export all user data for GDPR compliance
**When to use:** Per-user full data export
**Source:** CONTEXT.md - includes profile, forms, assessments, video progress

```typescript
// Server action to aggregate all user data
"use server";

interface GDPRExportData {
  profile: Profile;
  preWorkoutForms: PreWorkoutForm[];
  postWorkoutForms: PostWorkoutForm[];
  nutritionForms: NutritionForm[];
  assessments: PlayerAssessment[];
  videoProgress: VideoProgress[];
}

export async function exportUserDataAction(userId: string): Promise<{
  success: true;
  data: GDPRExportData;
} | { error: string }> {
  // Verify admin
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // ... admin verification

  const adminClient = createAdminClient();

  // Fetch all user data (NOT activity logs, payments, goals per CONTEXT.md)
  const [
    { data: profile },
    { data: preWorkoutForms },
    { data: postWorkoutForms },
    { data: nutritionForms },
    { data: assessments },
    { data: videoProgress },
  ] = await Promise.all([
    adminClient.from("profiles").select("*").eq("id", userId).single(),
    adminClient.from("pre_workout_forms").select("*").eq("user_id", userId),
    adminClient.from("post_workout_forms").select("*").eq("user_id", userId),
    adminClient.from("nutrition_forms").select("*").eq("user_id", userId),
    adminClient.from("player_assessments").select("*").eq("user_id", userId).is("deleted_at", null),
    adminClient.from("video_progress").select("*").eq("user_id", userId),
  ]);

  return {
    success: true,
    data: {
      profile: profile!,
      preWorkoutForms: preWorkoutForms || [],
      postWorkoutForms: postWorkoutForms || [],
      nutritionForms: nutritionForms || [],
      assessments: assessments || [],
      videoProgress: videoProgress || [],
    },
  };
}
```

### Pattern 6: Delete Confirmation Dialog (ESTABLISHED)

**What:** Confirmation dialog before destructive action
**When to use:** Assessment deletion
**Source:** Existing `DeleteUserDialog.tsx`

```typescript
// Follow DeleteUserDialog.tsx pattern exactly
// - AlertDialog from shadcn/ui
// - Loading state during action
// - toast.success/error feedback
// - Router refresh after success
```

### Anti-Patterns to Avoid

- **Hard delete assessments:** Always use soft delete with `deleted_at`
- **Missing BOM for CSV:** Hebrew will appear garbled in Excel without `\uFEFF` prefix
- **Complex date picker for simple filtering:** Native HTML date inputs work fine for date range
- **Calculating rankings in export:** Export raw measurements only (per CONTEXT.md decision)
- **Including activity logs in GDPR:** Excluded per CONTEXT.md decision

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV generation | Manual string concat | PapaParse | Handles escaping, quotes, special chars |
| Hebrew BOM | Forget it | `\uFEFF` prefix | Excel requires BOM for UTF-8 Hebrew |
| PDF generation | Canvas to image | @react-pdf/renderer | Component-based, React-like API |
| Date formatting | Manual string ops | date-fns | Locale support, reliable parsing |
| Soft delete | Manual timestamp | Pattern + `deleted_by` | Audit trail, consistency |

**Key insight:** The project already has all infrastructure needed - follow Phase 2 patterns for CSV, Phase 1 patterns for soft delete. Only new piece is PDF generation.

## Common Pitfalls

### Pitfall 1: Excel Opens Hebrew as Garbled Text

**What goes wrong:** Hebrew characters appear as gibberish in Excel
**Why it happens:** Missing UTF-8 BOM at start of CSV file
**How to avoid:** Always prepend `\uFEFF` to CSV content before creating blob
**Warning signs:** Works in text editor but not Excel

### Pitfall 2: PDF RTL Text Rendering Issues

**What goes wrong:** Hebrew text in PDF appears left-to-right or reversed
**Why it happens:** @react-pdf/renderer has limited RTL support
**How to avoid:**
- Use `flexDirection: "row-reverse"` on containers
- Use `textAlign: "right"` on text
- Register Hebrew font (Heebo/OpenSansHebrew)
- Keep content simple (data tables, no complex nested layouts)
**Warning signs:** Numbers appear flipped, brackets reversed

### Pitfall 3: Date Format Inconsistency

**What goes wrong:** Dates exported in different formats
**Why it happens:** Using different formatting in different places
**How to avoid:** Create shared `formatDateForExport()` using DD/MM/YYYY (per CONTEXT.md)
**Warning signs:** Some dates as "2026-02-01", others as "01/02/2026"

### Pitfall 4: Forgot to Add deleted_by Migration

**What goes wrong:** `deleted_by` column doesn't exist in database
**Why it happens:** TypeScript type updated but migration not run
**How to avoid:** Create migration adding `deleted_by UUID` to `player_assessments`
**Warning signs:** Database error on assessment deletion

### Pitfall 5: GDPR Export Missing Data

**What goes wrong:** User data export incomplete
**Why it happens:** Forgot to include a table
**How to avoid:** Use CONTEXT.md checklist: profile, forms (3 types), assessments, video_progress
**Warning signs:** User reports missing data

### Pitfall 6: Large Export Crashes Browser

**What goes wrong:** Export hangs or browser tab crashes
**Why it happens:** Too much data processed client-side
**How to avoid:**
- Add date range filters to limit data
- Stream large exports from server
- Show loading indicator
**Warning signs:** Exports work for small datasets but fail for large ones

## Code Examples

### Form Submissions Export with Date Filter

```typescript
// src/components/admin/exports/SubmissionExportButton.tsx
"use client";

import { useState } from "react";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Calendar } from "lucide-react";
import { toast } from "sonner";

interface SubmissionExportButtonProps {
  formType: "pre_workout" | "post_workout" | "nutrition";
  submissions: FormSubmission[];
}

export function SubmissionExportButton({
  formType,
  submissions,
}: SubmissionExportButtonProps) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const handleExport = () => {
    // Filter by date range if provided
    let filtered = submissions;

    if (startDate) {
      filtered = filtered.filter(s => s.submitted_at >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter(s => s.submitted_at <= endDate + "T23:59:59");
    }

    if (filtered.length === 0) {
      toast.error("אין נתונים לייצוא בטווח התאריכים שנבחר");
      return;
    }

    // Transform to Hebrew columns
    const csvData = filtered.map(s => ({
      "שם מלא": s.full_name,
      "תאריך הגשה": formatDateHebrew(s.submitted_at),
      // ... form-specific fields
    }));

    // Export with BOM
    const csv = Papa.unparse(csvData);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${formTypeToHebrew(formType)}-${formatDateForFilename(new Date())}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);

    toast.success(`יוצאו ${filtered.length} שאלונים`);
  };

  return (
    <div className="flex items-end gap-4">
      <div>
        <Label htmlFor="start-date">מתאריך</Label>
        <Input
          id="start-date"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-40"
        />
      </div>
      <div>
        <Label htmlFor="end-date">עד תאריך</Label>
        <Input
          id="end-date"
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="w-40"
        />
      </div>
      <Button onClick={handleExport} variant="outline">
        <Download className="h-4 w-4 ml-2" />
        ייצוא ל-CSV
      </Button>
    </div>
  );
}

function formatDateHebrew(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateForFilename(date: Date): string {
  return date.toISOString().split("T")[0];
}

function formTypeToHebrew(type: string): string {
  switch (type) {
    case "pre_workout": return "שאלון-לפני-אימון";
    case "post_workout": return "שאלון-אחרי-אימון";
    case "nutrition": return "שאלון-תזונה";
    default: return "שאלונים";
  }
}
```

### Assessment Export to CSV

```typescript
// src/components/admin/exports/AssessmentExportButton.tsx
"use client";

import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { ASSESSMENT_LABELS_HE } from "@/types/assessment";
import type { PlayerAssessment } from "@/types/assessment";

interface AssessmentExportButtonProps {
  playerName: string;
  assessments: PlayerAssessment[];
}

export function AssessmentExportButton({
  playerName,
  assessments,
}: AssessmentExportButtonProps) {
  const handleExport = () => {
    // Raw measurements only (per CONTEXT.md - no rankings)
    const csvData = assessments.map((a) => ({
      "שם שחקן": playerName,
      "תאריך מבדק": formatDateHebrew(a.assessment_date),
      [ASSESSMENT_LABELS_HE.sprint_5m]: a.sprint_5m ?? "",
      [ASSESSMENT_LABELS_HE.sprint_10m]: a.sprint_10m ?? "",
      [ASSESSMENT_LABELS_HE.sprint_20m]: a.sprint_20m ?? "",
      [ASSESSMENT_LABELS_HE.jump_2leg_distance]: a.jump_2leg_distance ?? "",
      [ASSESSMENT_LABELS_HE.jump_2leg_height]: a.jump_2leg_height ?? "",
      [ASSESSMENT_LABELS_HE.blaze_spot_time]: a.blaze_spot_time ?? "",
      [ASSESSMENT_LABELS_HE.flexibility_ankle]: a.flexibility_ankle ?? "",
      [ASSESSMENT_LABELS_HE.flexibility_knee]: a.flexibility_knee ?? "",
      [ASSESSMENT_LABELS_HE.flexibility_hip]: a.flexibility_hip ?? "",
      [ASSESSMENT_LABELS_HE.kick_power_kaiser]: a.kick_power_kaiser ?? "",
      [ASSESSMENT_LABELS_HE.coordination]: getCategoricalHebrew("coordination", a.coordination),
      [ASSESSMENT_LABELS_HE.body_structure]: getCategoricalHebrew("body_structure", a.body_structure),
      "הערות": a.notes ?? "",
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `מבדקים-${playerName}-${formatDateForFilename(new Date())}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <Button onClick={handleExport} variant="outline" disabled={assessments.length === 0}>
      <Download className="h-4 w-4 ml-2" />
      ייצוא ל-CSV
    </Button>
  );
}
```

### Delete Assessment Dialog

```typescript
// src/components/admin/assessments/DeleteAssessmentDialog.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { softDeleteAssessmentAction } from "@/lib/actions/admin-assessments";

interface DeleteAssessmentDialogProps {
  assessmentId: string;
  assessmentDate: string;
  trigger?: React.ReactNode;
}

export function DeleteAssessmentDialog({
  assessmentId,
  assessmentDate,
  trigger,
}: DeleteAssessmentDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    setLoading(true);
    try {
      const result = await softDeleteAssessmentAction(assessmentId);

      if (!("success" in result)) {
        toast.error(result.error);
        return;
      }

      toast.success("המבדק נמחק בהצלחה");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("שגיאה במחיקת המבדק");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>מחיקת מבדק</AlertDialogTitle>
          <AlertDialogDescription>
            האם אתה בטוח שברצונך למחוק את המבדק מתאריך{" "}
            <strong>{new Date(assessmentDate).toLocaleDateString("he-IL")}</strong>?
            המבדק יסומן כמחוק אך הנתונים ישמרו במערכת.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>ביטול</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                מוחק...
              </>
            ) : (
              "מחק מבדק"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual CSV string | PapaParse | Standard | Proper escaping, edge cases handled |
| jsPDF for PDFs | @react-pdf/renderer | 2023+ | Component-based, better DX |
| Manual date parsing | date-fns | Standard | Locale support, reliability |
| Hard delete | Soft delete + audit | Phase 1 | Recoverable, audit trail |

**Deprecated/outdated:**
- `moment.js`: Use date-fns instead (smaller, tree-shakeable)
- jsPDF without BiDi: Poor RTL support, use @react-pdf/renderer
- ExcelJS for simple exports: Overkill, use PapaParse for CSV

## Open Questions

1. **Font Hosting for PDFs**
   - What we know: @react-pdf/renderer needs Hebrew font file (TTF/OTF)
   - What's unclear: Where to host font file (public folder vs CDN vs bundled)
   - Recommendation: Host in `/public/fonts/` for simplicity, ensure font file is included in git

2. **Large Export Performance**
   - What we know: Client-side CSV generation may be slow for thousands of records
   - What's unclear: Actual data volume in production
   - Recommendation: Start with client-side, add server-side streaming if needed. Date range filter will limit volume.

3. **PDF Branding Assets**
   - What we know: Need logo for PDF header
   - What's unclear: Which logo file to use, exact dimensions
   - Recommendation (Claude's discretion): Use same logo as in app header, scale to fit

## Sources

### Primary (HIGH confidence)
- [PapaParse Documentation](https://www.papaparse.com/docs) - CSV parsing/generation
- [Existing UserExportButton.tsx](/src/components/admin/users/UserExportButton.tsx) - Established CSV pattern
- [Existing DeleteUserDialog.tsx](/src/components/admin/users/DeleteUserDialog.tsx) - Established delete pattern
- [@react-pdf/renderer - Context7](/diegomura/react-pdf) - PDF generation API
- [shadcn/ui Calendar - Context7](/websites/ui_shadcn) - Date picker components

### Secondary (MEDIUM confidence)
- [jsPDF RTL Support Issues](https://github.com/parallax/jsPDF/issues/2235) - RTL challenges in PDF
- [@react-pdf/renderer RTL Discussion](https://github.com/diegomura/react-pdf/issues/1571) - RTL workarounds
- [Phase 1 Soft Delete Migration](/supabase/migrations/20260201131812_security_indexes_and_soft_delete.sql) - Established pattern

### Tertiary (LOW confidence)
- WebSearch for PDF RTL best practices - Multiple sources agree on workarounds

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Libraries already installed/proven in Phase 2
- Architecture: HIGH - Following established patterns from earlier phases
- Pitfalls: HIGH - Based on existing patterns and documented issues
- PDF RTL: MEDIUM - Workarounds work but not native support

**Research date:** 2026-02-01
**Valid until:** 2026-03-01 (30 days - stable domain)

---

*Phase: 04-data-export-assessments*
*Research complete: Ready for planning*
