<!-- Generated: 2026-06-22 | Files scanned: 545 | Token estimate: ~820 -->

# Frontend Codemap

## Page Tree (`src/app`)

```
app/
├── page.tsx                          Landing (public)
├── layout.tsx                        Root layout — RTL, global providers
├── auth/
│   ├── login/page.tsx                WhatsApp OTP login
│   ├── verify/page.tsx               OTP code entry
│   ├── verify-2fa/page.tsx           TOTP second factor
│   └── callback/route.ts             Supabase auth callback
├── onboarding/
│   └── profile/page.tsx              First-run profile completion
├── dashboard/                        Trainee area (role-gated)
│   ├── page.tsx                      Home — ratings, streaks, next-game card
│   ├── assessments/page.tsx          Assessment history + charts
│   ├── forms/                        Workout / nutrition / pre-post game forms
│   │   ├── page.tsx                  Form hub
│   │   ├── mental/page.tsx           Mental recording upload
│   │   ├── next-game/page.tsx        Pre-game readiness form
│   │   ├── nutrition/page.tsx        Daily nutrition log
│   │   ├── pre-workout/page.tsx
│   │   └── post-workout/page.tsx
│   ├── nutrition/page.tsx            Trainee meal plan viewer (PDF)
│   ├── rankings/page.tsx             Leaderboard
│   ├── videos/page.tsx               Coaching video library
│   └── settings/security/page.tsx   MFA setup
├── admin/                            Admin/trainer area
│   ├── page.tsx                      Admin home / stats
│   ├── assessments/[userId]/page.tsx Per-user assessment list + new/edit
│   ├── end-of-shift/page.tsx         Shift-report wizard
│   ├── leads/page.tsx                Leads CRM — dynamic tabs, bulk paste
│   ├── nutrition/[userId]/page.tsx   Per-user nutrition + measurements
│   ├── reports/generate/[userId]/page.tsx  PDF player report generation
│   ├── retention/page.tsx            Retention dashboard (Arbox sync)
│   ├── shifts/page.tsx               Shift clock-in/out + change requests
│   ├── submissions/page.tsx          Form submission viewer
│   ├── submissions/shift-reports/[id]/page.tsx
│   ├── upcoming-games/page.tsx       Next-game admin config
│   ├── users/page.tsx                Trainee list
│   ├── users/[userId]/page.tsx       Trainee detail — profile, ratings, history
│   ├── users/create/page.tsx         Create trainee
│   └── videos/page.tsx + create/     Video management
└── api/
    ├── cron/*                        8 cron handlers (arbox-sync, auto-clockout, retention-report, …)
    ├── images/*                      Upload + background-removal pipeline
    ├── nutrition/upload-pdf/         Meal-plan PDF upload
    ├── payments/create/              Meshulam payment init
    ├── player-report/pdf/            React-PDF generation endpoint
    ├── shifts/sync/                  Offline queue flush
    ├── webhooks/grow/ + leads/       Payment + lead webhooks
    └── whatsapp/flow/                WhatsApp Flow OTP handler
```

## Component Hierarchy (`src/components`)

### admin/ — shared admin primitives
- `AdminSidebar`, `AdminBottomNav` — nav shells
- `TableToolbar` + `ToolbarSelect/Checkbox/DateRange` — search/filter bar (parent owns state)
- `TablePagination`, `DeleteConfirmDialog` — shared table chrome
- `AssessmentForm`, `AssessmentStepContent` — multi-step assessment wizard
- `UserEditForm`, `ActivityLogTable/Row`, `ClickableTableRow`, `ClipPlaybackCard`, `NextGameAdminCard`

### admin/assessments/
`AssessmentsContent`, `AssessmentsTable`, `AssessmentsMonthView`, `AssessmentDetailDialog`, `AssessmentSectionPopover`, `AssessmentStatusBadge`, `DeleteAssessmentDialog`, `MonthPicker`

### admin/leads/
`LeadsTabs`, `LeadTabsManager`, `LeadTabFormDialog`, `LeadTabDeleteDialog`, `LeadTabBadge` — dynamic named tabs; `LeadDataTable`, `LeadTableColumns`, `LeadTableToolbar`, `LeadDetailSheet`, `LeadCreateDialog`, `LeadCloseDealDialog`, `LeadContactLogForm`, `LeadContactTimeline`, `LeadStatsPanel`, `LeadStatusBadge`, `PasteLeadsDialog` — bulk paste importer; `TrainerAssignmentSelect`

### admin/nutrition/
`NutritionTable`, `MealPlanPdfUpload`, `MeasurementForm`, `MeasurementsCard`, `MeasurementsTable`, `RecommendationForm`

### admin/retention/
`RetentionPageClient`, `RetentionTable`, `RetentionNoteCell`, `ChurnedCustomersTab`, `ChurnedCustomerRow`, `ChurnedColorPicker`, `MoveToChurnedButton`, `PasteChurnedDialog`

### admin/shifts/
`ShiftFormDialog`, `ShiftStatusCard`, `ShiftOtherPurposeDialog`, `TrainerShiftsView`, `ShiftRequestsAdminPanel`, `ShiftRequestDetailSheet`, `EditShiftRequestDialog`, `ApproveRequestDialog`, `RejectRequestDialog`, `RetroShiftRequestDialog`, `MyShiftRequestsList`, `ConnectionBanner`, `FailedSyncsBanner`

### admin/shift-report/
`ShiftReportForm`, `ShiftReportStepContent`, `PerTraineeSections`, `TraineeMultiSelect`

### admin/submissions/
`SubmissionsContent`, `ShiftReportContent`

### admin/users/
`UserDataTable`, `UserTableColumns`, `UserTableToolbar`, `UserTablePagination`, `UserCreateForm`, `UserImportDialog`, `UserActionsCard`, `TraineeNotesCard`, `TraineeImageSection`, `TraineeImageUpload`, `DeleteUserDialog`, `CommunicationHistoryCard`

### admin/videos/
`VideoDataTable`, `VideoListClient`, `VideoTableColumns`, `VideoTableToolbar`, `VideoTablePagination`, `VideoForm`, `VideoCreateForm`, `DeleteVideoDialog`

### admin/exports/
`AssessmentExportButton`, `AssessmentPdfButton`, `LeadExportButton`, `ShiftReportExportButton`, `SubmissionExportButton`, `UserDataExportButton` — Hebrew headers, BOM, Papa.unparse

### dashboard/
`DashboardSidebar`, `DashboardBottomNav`, `VideoCard`, `ClipUploadCard`, `NextGameCard`, `MentalRecordingsCard`, `RatingMigrationBanner`

### landing/
`Navbar`, `Hero`, `About`, `Programs`, `Services`, `Staff`, `Testimonials`, `FAQ`, `Contact`, `Footer`

### auth/
`TwoFactorSetup`, `TwoFactorVerify`

### forms/
`FormSubmitButton`, `FormBackButton`

### layout/
`AppSidebar`, `AppTopBar`

### onboarding/
`ProfileCompletionForm`

### payments/
`PaymentStatusHandler`

### player-card/
`PlayerCard`, `PlayerStatsDetail`

### ui/ — 27 Radix/shadcn primitives
`alert-dialog`, `avatar`, `badge`, `badges`, `bottom-nav`, `button`, `card`, `checkbox`, `dialog`, `dropdown-menu`, `form`, `input`, `label`, `popover`, `progress-stepper`, `progress`, `select`, `separator`, `sheet`, `sidebar`, `skeleton`, `sonner`, `switch`, `table`, `tabs`, `textarea`, `tooltip`

## Feature Modules (`src/features`) — 13 modules

| Module | Purpose |
|---|---|
| `achievements` | Badge definitions, unlock logic, award actions |
| `assessment-comparison` | Side-by-side assessment diff components + transforms |
| `clips` | Mental-recording clip upload + expiry actions |
| `form-drafts` | IndexedDB-backed draft persistence for workout forms |
| `goals` | Trainee goal CRUD, config, progress utils |
| `next-game` | Pre-game form data, admin game config actions |
| `nutrition` | Meal-plan PDF management, nutrition log components |
| `onboarding-tour` | Shepherd.js guided tour, steps config, tour actions |
| `player-assessments` | Assessment CRUD actions, validation, ranking utils |
| `player-report` | PDF report generation components, layout utils, schema |
| `progress-charts` | Recharts progress charts, data transforms, chart config |
| `rankings` | Leaderboard actions, percentile ranking, config |
| `streak-tracking` | Streak calculation, display components, cron-driven updates |

## Shared Hooks (`src/hooks`)

| Hook | Purpose |
|---|---|
| `useFormSubmission` | Submit state + error handling for server actions |
| `useIsMobile` / `useMediaQuery` | Responsive breakpoint detection |
| `useBackgroundRemoval` | RemoveBG API client-side trigger |
| `use-mfa` | TOTP enroll/verify flow |
| `use-connection-status` | Online/offline detection for shift queue |
| `use-shift-queue-sync` | Flush offline shift queue on reconnect |

## State Approach

- **Server state**: RSC + server actions (no fetch library)
- **URL state**: nuqs for filters, tabs, pagination
- **Form state**: react-hook-form + Zod validation
- **Offline queue**: IndexedDB via `form-drafts` + shift queue flushed by `use-shift-queue-sync`
- **Toast**: Sonner via `sonner` ui primitive

## New since 2026-05-26

- **leads**: Dynamic named tabs (`LeadTabsManager`, `LeadTabFormDialog`, `LeadTabDeleteDialog`, `LeadTabBadge`, `LeadsTabs`); bulk paste-from-Sheets importer (`PasteLeadsDialog`); trainer assignment (`TrainerAssignmentSelect`)
- **retention**: Churned-customers tab (`ChurnedCustomersTab`, `ChurnedCustomerRow`, `ChurnedColorPicker`, `MoveToChurnedButton`, `PasteChurnedDialog`); Arbox snapshot merge on refresh
- **shifts**: Other-purpose shift logging (`ShiftOtherPurposeDialog`); change-request dialogs (`EditShiftRequestDialog`, `ApproveRequestDialog`, `RejectRequestDialog`, `RetroShiftRequestDialog`); offline queue + connection banner; shift-report upsert to prevent duplicate-key crash
- **nutrition**: Measurement sub-feature (`MeasurementForm`, `MeasurementsCard`, `MeasurementsTable`); two-PDF meal-plan upload (`MealPlanPdfUpload`)
- **users**: Trainee communication-history log card (`CommunicationHistoryCard`)
