---
phase: 04-data-export-assessments
plan: 03
subsystem: admin-exports
tags: [csv-export, form-submissions, date-filter, hebrew-export]

dependency-graph:
  requires:
    - "02-05: BOM CSV export pattern for Hebrew"
  provides:
    - "SubmissionExportButton: Reusable export component with date filtering"
    - "Form submission CSV export for all three form types"
  affects:
    - "Future export components can follow this pattern"

tech-stack:
  added: []
  patterns:
    - "Date range filtering with native HTML date inputs"
    - "Form-type-specific Hebrew column mapping"
    - "Type assertion for union type filtering"

files:
  key-files:
    created:
      - "src/components/admin/exports/SubmissionExportButton.tsx"
    modified:
      - "src/app/admin/submissions/page.tsx"

decisions:
  - id: type-assertion-for-filtering
    choice: "Use type assertion through unknown for date filtering"
    rationale: "Union types don't narrow correctly with filter(), assertion through unknown is safe since all forms have submitted_at"
  - id: extended-column-mapping
    choice: "Include more fields than plan specified in exports"
    rationale: "Export all relevant fields to maximize usefulness, not just the minimal set"
  - id: unique-input-ids
    choice: "Use formType in input IDs to avoid conflicts"
    rationale: "Multiple export buttons on same page need unique IDs for accessibility"

metrics:
  duration: "~10 minutes"
  completed: "2026-02-01"
---

# Phase 04 Plan 03: Form Submission CSV Export Summary

CSV export with date filtering for form submissions, enabling admins to export pre-workout, post-workout, and nutrition form data with Hebrew column headers.

## One-liner

SubmissionExportButton with date range filtering and Hebrew CSV export using PapaParse with BOM prefix for Excel compatibility.

## What Was Built

### SubmissionExportButton Component

Created `src/components/admin/exports/SubmissionExportButton.tsx` with:

1. **Date Range Filter**
   - Native HTML date inputs for start and end dates
   - Inclusive filtering (end date includes entire day with T23:59:59)
   - No filter = export all data

2. **Form-Type-Specific Column Mapping**
   - Pre-workout: full_name, age, sleep_hours, nutrition (translated), injury, group_training, urine_color, last_game, improvements, next_match, submitted_at
   - Post-workout: full_name, trainer, difficulty, satisfaction, comments, training_date, submitted_at
   - Nutrition: full_name, age, weight, height, allergies (yes/no), allergy_details, chronic_conditions, conditions_details, medications, years_competitive, previous_counseling, counseling_details, submitted_at

3. **Hebrew Support**
   - UTF-8 BOM prefix (`\uFEFF`) for Excel compatibility
   - Hebrew column headers
   - Hebrew filename with form type translation
   - Nutrition status translation (full_energy -> "מלא אנרגיה", etc.)

4. **User Feedback**
   - Toast success: "יוצאו X שאלונים"
   - Toast error for empty results: "אין נתונים לייצוא בטווח התאריכים שנבחר"

### Submissions Page Integration

Updated `src/app/admin/submissions/page.tsx`:

1. **Export Buttons on Each Tab**
   - Pre-workout tab: `formType="pre_workout"`
   - Post-workout tab: `formType="post_workout"`
   - Nutrition tab: `formType="nutrition"`

2. **Increased Data Limit**
   - Changed from `.limit(50)` to `.limit(1000)` for all queries
   - Allows more data to be available for export

3. **Layout Update**
   - CardHeader now uses flex layout for title/description + export button
   - Responsive: stacks on mobile, side-by-side on desktop

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Type assertion for filtering | Cast through `unknown` | Union types don't narrow with filter(), all forms have submitted_at |
| Extended column mapping | Include all relevant fields | Maximize export usefulness |
| Unique input IDs | Include formType in ID | Multiple export buttons need unique IDs for a11y |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript union type filtering**
- **Found during:** Task 1
- **Issue:** TypeScript couldn't narrow union type when filtering by submitted_at
- **Fix:** Used type assertion through `unknown` for filtering, then cast back for transformation
- **Files modified:** src/components/admin/exports/SubmissionExportButton.tsx

**2. [Rule 2 - Missing Critical] Extended column mapping beyond plan minimum**
- **Found during:** Task 1
- **Issue:** Plan only specified minimal columns, but exports should include all useful data
- **Fix:** Added all relevant form fields to each form type's column mapping
- **Files modified:** src/components/admin/exports/SubmissionExportButton.tsx

## Commits

| Hash | Type | Description |
|------|------|-------------|
| bd28591 | feat | add SubmissionExportButton with date filtering |
| d770bde | feat | add export buttons to submissions page |

## Verification Results

- [x] SubmissionExportButton component exists (213 lines)
- [x] Submissions page imports SubmissionExportButton
- [x] Export button on pre-workout tab with formType="pre_workout"
- [x] Export button on post-workout tab with formType="post_workout"
- [x] Export button on nutrition tab with formType="nutrition"
- [x] TypeScript compiles without new errors
- [x] Papa.unparse used for CSV generation
- [x] BOM prefix included for Hebrew Excel support

## Next Phase Readiness

**Ready for:** Plan 04-04 (Assessment Export) and 04-05 (Assessment PDF)

**Dependencies satisfied:**
- Export directory created at `src/components/admin/exports/`
- Pattern established for CSV export with Hebrew support
- Date filtering pattern available for reuse

---

*Plan: 04-03 | Completed: 2026-02-01*
