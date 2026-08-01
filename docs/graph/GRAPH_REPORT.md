# Graph Report - .  (2026-08-01)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 3482 nodes · 10768 edges · 206 communities (143 shown, 63 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 43 edges (avg confidence: 0.62)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `16d469e7`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- AssessmentStepContent.tsx
- LeadDetailSheet.tsx
- createClient
- button.tsx
- typedFrom
- retention.ts
- card.tsx
- verifyAdminOrTrainer
- cn
- landing/index.ts
- SetGoalDialog.tsx
- LeaderboardTable.tsx
- getAdminClient
- import-utils.ts
- types/assessment.ts
- ShiftReportStepContent.tsx
- admin-book-parameters.ts
- development-book/lib/types.ts
- CardHeader
- RetentionPageClient.tsx
- nutrition/index.ts
- dashboard/page.tsx
- AssessmentsMonthView.tsx
- admin-book-drills.ts
- admin-lead-tabs.ts
- normalizePhone
- admin.ts
- DrillCard.tsx
- PlayerAssessment
- PlayerStatsDetail.tsx
- assessment-to-rating.ts
- compilerOptions
- AssessmentForm.tsx
- AdminSidebar.tsx
- upload-trainee-images/route.ts
- achievements/index.ts
- book-read.ts
- database.ts
- admin-retention.ts
- shifts/page.tsx
- ParameterForm.tsx
- snapshot.ts
- seed-development-book.ts
- admin-churned-customers.ts
- streak-tracking/index.ts
- admin-submissions-list.ts
- utils.ts
- AssessmentComparison.tsx
- validations/shift-change-requests.ts
- israel-time.ts
- grow/route.ts
- SubmissionsContent.tsx
- TrainerShiftsView.tsx
- progress-charts/index.ts
- TwoFactorSetup.tsx
- ActivityLogRow.tsx
- ShiftRequestsAdminPanel.tsx
- UserDataTable.tsx
- DrillCardForm.tsx
- player-report-html.ts
- migrate-csv-assessments.ts
- ShiftStatusCard.tsx
- AppTopBar.tsx
- workouts/lib/types.ts
- login/page.tsx
- ReportEditor.tsx
- trainee-notes.ts
- programs.ts
- components.json
- [formId]/page.tsx
- whatsapp/client.ts
- ClipUploadCard.tsx
- shift-queue.ts
- driver.js
- create/route.ts
- pdf/route.ts
- actions/next-game.ts
- security/page.tsx
- Profile
- ReportPage
- flow/route.ts
- RatingTrendChart.tsx
- RetentionTable.tsx
- ExerciseTable.tsx
- get-achievements.ts
- ranking-utils.ts
- onboarding-tour/index.ts
- pdf-player-report-template.tsx
- devDependencies
- TraineeImageUpload.tsx
- VideoTableColumns.tsx
- nutrition/[userId]/page.tsx
- trainer-shifts.ts
- NutritionTable.tsx
- dependencies
- scripts
- CommunicationHistoryCard.tsx
- validations/profile.ts
- progress-charts/lib/utils/index.ts
- shared/index.ts
- parse-leads-paste.ts
- manifest.json
- SubmissionExportButton.tsx
- useFormDraft.ts
- import-season-prep-leads.ts
- relink-arbox-and-backfill-birthdates.ts
- seed-fitness-kondos.ts
- reports.ts
- migrate-jan26.ts
- ProgramBuilder.tsx
- app/layout.tsx
- user-import.ts
- wcag.ts
- package.json
- backfill-birthdates-from-age.ts
- verify-shift-changes.ts
- upload/route.ts
- WorkoutVideo
- arbox-sync-birthdays.ts
- migrate-d1-to-supabase.ts
- parse-churned-paste.ts
- MyShiftRequestsList.tsx
- fix-phone-format.ts
- restore-may-retention.ts
- seed-drill-cards.ts
- PhysicalMetricChart.tsx
- profile.test.ts
- sw.js
- backfill-birthdates-from-csv.ts
- debug-matched-profiles.ts
- debug-with-birthdates.ts
- env.ts
- rate-limit.ts
- cleanup-trainees.ts
- debug-arbox-ids.ts
- src/middleware.ts
- workouts/layout.tsx
- settings/layout.tsx
- sidebar.spec.ts
- class-variance-authority
- clsx
- eslint
- eslint.config.mjs
- eslint-config-next
- framer-motion
- @hookform/resolvers
- html-to-image
- @huggingface/transformers
- husky
- jsdom
- lint-staged
- lucide-react
- .mcp.json
- next
- next.config.ts
- next-themes
- node-html-parser
- nuqs
- papaparse
- puppeteer-core
- radix-ui
- @radix-ui/react-accordion
- @radix-ui/react-alert-dialog
- @radix-ui/react-avatar
- @radix-ui/react-checkbox
- @radix-ui/react-dialog
- @radix-ui/react-dropdown-menu
- @radix-ui/react-label
- @radix-ui/react-select
- @radix-ui/react-separator
- @radix-ui/react-slot
- @radix-ui/react-switch
- react-dom
- react-hook-form
- react-icons
- @react-pdf/renderer
- sonner
- @sparticuz/chromium
- @supabase/ssr
- @supabase/supabase-js
- @tanstack/react-table
- @upstash/ratelimit
- @upstash/redis
- @vercel/analytics
- @vercel/functions
- @vercel/speed-insights
- zod
- @playwright/test
- tailwindcss
- @types/node
- @types/papaparse
- @types/react-dom
- @vitejs/plugin-react
- vitest
- @vitest/coverage-v8
- xlsx
- postcss.config.mjs
- vercel.json

## God Nodes (most connected - your core abstractions)
1. `createClient()` - 213 edges
2. `cn()` - 191 edges
3. `typedFrom()` - 160 edges
4. `verifyAdminOrTrainer()` - 150 edges
5. `Button()` - 127 edges
6. `isValidUUID()` - 127 edges
7. `Card()` - 117 edges
8. `CardContent()` - 117 edges
9. `createAdminClient()` - 108 edges
10. `CardHeader()` - 82 edges

## Surprising Connections (you probably didn't know these)
- `ParsedParameter` --references--> `CanonicalPosition`  [EXTRACTED]
  scripts/seed-development-book.ts → src/features/development-book/lib/types.ts
- `buildPlayerReportHtml()` --indirect_call--> `s()`  [INFERRED]
  src/lib/exports/player-report-html.ts → scripts/seed-workout-exercises.ts
- `FormItem()` --references--> `react`  [EXTRACTED]
  src/components/ui/form.tsx → package.json
- `useFormField()` --references--> `react`  [EXTRACTED]
  src/components/ui/form.tsx → package.json
- `main()` --references--> `xlsx`  [EXTRACTED]
  scripts/seed-workout-exercises.ts → package.json

## Import Cycles
- None detected.

## Communities (206 total, 63 thin omitted)

### Community 0 - "AssessmentStepContent.tsx"
Cohesion: 0.07
Nodes (71): getDefaultValues(), MentalQuestionnairePage(), defaultValues, NUMERIC_FIELDS, NutritionFormPage(), getDefaultValues(), PostWorkoutFormPage(), TrainerOption (+63 more)

### Community 1 - "LeadDetailSheet.tsx"
Cohesion: 0.05
Nodes (76): formatPhone(), LeadExportButton(), LeadExportButtonProps, LeadCloseDealDialog(), LeadCloseDealDialogProps, LeadContactLogForm(), LeadContactLogFormProps, contactTypeIcons (+68 more)

### Community 2 - "createClient"
Cohesion: 0.06
Nodes (63): AdminTraineeNutritionPage(), AdminDashboardPage(), GenerateReportPage(), PageProps, AdminShiftsPage(), AdminSubmissionsPage(), NutritionPage(), OnboardingProfilePage() (+55 more)

### Community 3 - "button.tsx"
Cohesion: 0.09
Nodes (58): DeleteAssessmentDialogProps, AddParameterButton(), AddParameterButtonProps, BookCategoryClient(), BookCategoryClientProps, CategoryActionsProps, CategoryDialogProps, DeleteConfirmDialog() (+50 more)

### Community 4 - "typedFrom"
Cohesion: 0.05
Nodes (69): EndOfShiftPage(), GET(), GET(), POST(), LeadDetailSheet(), ActionResult, ClipRow, ClipWithSignedUrl (+61 more)

### Community 5 - "retention.ts"
Cohesion: 0.07
Nodes (59): ALL_MONTHS, allEntries(), APPLY, earliestEndDate(), EMPTY, findDuplicateIdentities(), identityScheme(), main() (+51 more)

### Community 6 - "card.tsx"
Cohesion: 0.08
Nodes (5): Card(), CardContent(), Skeleton(), ReportBulletListProps, ReportSummarySectionProps

### Community 7 - "verifyAdminOrTrainer"
Cohesion: 0.06
Nodes (59): ShiftReportDetailPage(), GET(), CategoryActions(), CategoryDialog(), VideoForm(), MuscleDialog(), ActionResult, AdminBookParameter (+51 more)

### Community 8 - "cn"
Cohesion: 0.07
Nodes (46): react, react, AppSidebar(), AppSidebarProps, AlertDialogOverlay(), CardAction(), CardFooter(), DialogOverlay() (+38 more)

### Community 9 - "landing/index.ts"
Cohesion: 0.07
Nodes (28): metadata, metadata, About(), categories, features, Contact(), transportRoutes, FAQ() (+20 more)

### Community 10 - "SetGoalDialog.tsx"
Cohesion: 0.14
Nodes (33): GoalCard(), GoalCelebrationClient(), GoalCelebrationClientProps, GoalManagementPanel(), GoalsList(), SetGoalDialog(), useGoalCelebration(), deleteGoal() (+25 more)

### Community 11 - "LeaderboardTable.tsx"
Cohesion: 0.12
Nodes (33): AgeGroupFilter(), AgeGroupFilterProps, CATEGORY_COLORS, CATEGORY_ICONS, CategoryLeaderCards(), CategoryLeaderCardsProps, DistributionChart(), DistributionChartProps (+25 more)

### Community 12 - "getAdminClient"
Cohesion: 0.09
Nodes (31): main(), CardlessDrill, main(), args, DRY_RUN, main(), MAPPING_PATH, MappingRow (+23 more)

### Community 13 - "import-utils.ts"
Cohesion: 0.13
Nodes (40): escapeCSV(), FILE_CONFIGS, FileConfig, main(), parseSection(), readFileSection(), writeMappingCSV(), args (+32 more)

### Community 14 - "types/assessment.ts"
Cohesion: 0.10
Nodes (34): PageProps, PlayerAssessmentsPage(), AssessmentChartsWrapper, DashboardAssessmentsPage(), metadata, DashboardPage(), AssessmentsMonthView(), AssessmentsTable() (+26 more)

### Community 15 - "ShiftReportStepContent.tsx"
Cohesion: 0.08
Nodes (38): BoolField, PerTraineeCard, PerTraineeCardProps, PerTraineeCategoriesSection, PerTraineeCategoriesSectionProps, PerTraineeDetailsCard, PerTraineeDetailsCardProps, PerTraineeDetailsSection (+30 more)

### Community 16 - "admin-book-parameters.ts"
Cohesion: 0.07
Nodes (35): AdminBookMusclesPage(), metadata, AdminParameterEditPage(), metadata, PageProps, MusclesClient(), ActionResult, deleteMuscle() (+27 more)

### Community 17 - "development-book/lib/types.ts"
Cohesion: 0.08
Nodes (41): BookPageProps, dynamic, metadata, Accordion(), AccordionContent(), AccordionItem(), AccordionTrigger(), AgePanel() (+33 more)

### Community 18 - "CardHeader"
Cohesion: 0.06
Nodes (37): AdminBookPage(), metadata, AdminNutritionPage(), metadata, AdminCreateUserPage(), AdminUsersPage(), metadata, PageProps (+29 more)

### Community 19 - "RetentionPageClient.tsx"
Cohesion: 0.11
Nodes (28): isSectionDone(), AssessmentDetailDialog(), AssessmentSectionPopover(), TrainerAssignmentSelect(), TrainerAssignmentSelectProps, ChurnedColorPicker(), ChurnedColorPickerProps, SWATCHES (+20 more)

### Community 20 - "nutrition/index.ts"
Cohesion: 0.11
Nodes (28): metadata, MealPlanPdfSlotProps, MealPlanPdfUpload(), MealPlanPdfUploadProps, MealPlanPdfViewer(), MealPlanPdfViewerProps, NutritionMeetingBanner(), NutritionMeetingBannerProps (+20 more)

### Community 21 - "dashboard/page.tsx"
Cohesion: 0.11
Nodes (19): ShiftReportDetailPageProps, AdminUpcomingGamesPage(), metadata, MiniRatingChartWrapper, NextGameAdminCard(), NextGameAdminCardProps, MentalRecordingsCard(), NextGameCard() (+11 more)

### Community 22 - "AssessmentsMonthView.tsx"
Cohesion: 0.13
Nodes (29): ageGroupOptions, AssessmentsMonthViewProps, MONTHS_HE, STATUS_FILTER_OPTIONS, ageGroupOptions, asSectionKey(), ASSESSMENT_SECTION_KEYS, FilterValues (+21 more)

### Community 23 - "admin-book-drills.ts"
Cohesion: 0.09
Nodes (32): AdminDrillEditPage(), metadata, PageProps, ActionResult, getDrillForEdit(), mapCardMetric(), mapCardPhase(), mapCardPhasePoint() (+24 more)

### Community 24 - "admin-lead-tabs.ts"
Cohesion: 0.09
Nodes (31): AdminLeadsPage(), metadata, PageProps, resolveActiveTab(), LeadsTabs(), FormBody(), ActionResult, assignLeadToTabAction() (+23 more)

### Community 25 - "normalizePhone"
Cohesion: 0.11
Nodes (25): main(), main(), normalizeName(), supabase, APPLY, main(), TargetRow, toLocalIsraeliPhone() (+17 more)

### Community 26 - "admin.ts"
Cohesion: 0.12
Nodes (24): MealPlanPdfSlot(), calculateAge(), computeBmi(), getDefaults(), MeasurementForm(), MeasurementFormProps, createMeasurement(), CreateResult (+16 more)

### Community 27 - "DrillCard.tsx"
Cohesion: 0.11
Nodes (21): DrillCardPage(), DrillCardPageProps, dynamic, metadata, DrillCardFormProps, BasicDrillViewProps, DrillCard(), DrillCardProps (+13 more)

### Community 28 - "PlayerAssessment"
Cohesion: 0.09
Nodes (23): AssessmentChartsWrapperProps, AssessmentFieldProps, AssessmentStepContentProps, NumberInputProps, SelectInputProps, TextareaInputProps, AssessmentExportButtonProps, AssessmentPdfButton() (+15 more)

### Community 29 - "PlayerStatsDetail.tsx"
Cohesion: 0.12
Nodes (27): CARD_CONFIG, MainStats, PlayerCard(), PlayerCardProps, CATEGORY_ICONS, PlayerStatsDetail(), PlayerStatsDetailProps, StatBar() (+19 more)

### Community 30 - "assessment-to-rating.ts"
Cohesion: 0.09
Nodes (21): avgOrNull(), BonusFn, calculateCardRatings(), calculateCardRatingsAbsolute(), calculateRatingHigherBetter(), calculateRatingLowerBetter(), CARD_STAT_CONFIG, clampOrNull() (+13 more)

### Community 31 - "compilerOptions"
Cohesion: 0.07
Nodes (29): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+21 more)

### Community 32 - "AssessmentForm.tsx"
Cohesion: 0.10
Nodes (23): EditAssessmentPage(), PageProps, NewAssessmentPage(), PageProps, UserEditPage(), AssessmentForm(), AssessmentFormProps, formDataToDbFormat() (+15 more)

### Community 33 - "AdminSidebar.tsx"
Cohesion: 0.12
Nodes (22): AdminLayout(), DashboardLayout(), AdminSidebar(), AdminSidebarProps, DashboardBottomNav(), DashboardSidebar(), DashboardSidebarProps, SidebarGroup() (+14 more)

### Community 34 - "upload-trainee-images/route.ts"
Cohesion: 0.28
Nodes (23): POST(), POST(), POST(), POST(), AuthResult, badRequestResponse(), parseFormDataSafe(), serverErrorResponse() (+15 more)

### Community 35 - "achievements/index.ts"
Cohesion: 0.20
Nodes (23): AchievementBadge(), LockedBadge(), AchievementsCard(), AchievementsList(), BADGE_CONFIGS, CATEGORY_LABELS, getAllBadgeTypes(), getBadgeConfig() (+15 more)

### Community 36 - "book-read.ts"
Cohesion: 0.08
Nodes (30): BookPage(), dynamic, metadata, ParentsBookPage(), ParentsPage(), getBookTree(), getDrillCard(), mapAgeRow() (+22 more)

### Community 37 - "database.ts"
Cohesion: 0.09
Nodes (28): ActionResult, GDPRExportData, ActivityLogRow, NutritionAppointmentStatus, NutritionForm, PaymentInsert, PaymentRow, PlayerAssessmentInsert (+20 more)

### Community 38 - "admin-retention.ts"
Cohesion: 0.15
Nodes (21): metadata, RetentionPage(), GET(), maxDuration, RetentionPageClient(), listChurnedCustomers(), getRetentionNotes(), getRetentionReport() (+13 more)

### Community 39 - "shifts/page.tsx"
Cohesion: 0.14
Nodes (20): AdminShiftsPageProps, metadata, AdminSubmissionsPageProps, PostWorkoutWithTrainer, dayTopics, metadata, VideosPage(), FailedSyncsBanner() (+12 more)

### Community 40 - "ParameterForm.tsx"
Cohesion: 0.12
Nodes (21): MuscleMultiSelect(), MuscleMultiSelectProps, AGE_ROW_COLUMNS, AgeGroup, AgeRow, ageRowToRow(), buildDrillColumns(), buildSnapshot() (+13 more)

### Community 41 - "snapshot.ts"
Cohesion: 0.12
Nodes (20): dryRun, env, main(), supabase, dynamic, GET(), maxDuration, runtime (+12 more)

### Community 42 - "seed-development-book.ts"
Cohesion: 0.13
Nodes (25): ALL_POSITION_LABELS, collapseWhitespace(), DIR, DrillsHtmlDrill, DRY_RUN, dryRun(), findNextSibling(), labelToGroup (+17 more)

### Community 43 - "admin-churned-customers.ts"
Cohesion: 0.11
Nodes (23): ChurnedCustomersTab(), ActionError, ActionOk, ActionResult, BulkResult, createChurnedCustomer(), createChurnedCustomersBulk(), deleteChurnedCustomer() (+15 more)

### Community 44 - "streak-tracking/index.ts"
Cohesion: 0.22
Nodes (17): StreakCard(), StreakCardProps, StreakCelebrationClient(), StreakCelebrationClientProps, useStreakCelebration(), getUserStreak(), CELEBRATION_STORAGE_KEY, STREAK_MILESTONES (+9 more)

### Community 45 - "admin-submissions-list.ts"
Cohesion: 0.13
Nodes (19): AdminAssessmentsPage(), metadata, AssessmentsContent(), formatDateForFilename(), formatDateHebrew(), ShiftReportExportButton(), ShiftReportExportButtonProps, AssessmentQueryParams (+11 more)

### Community 46 - "utils.ts"
Cohesion: 0.15
Nodes (15): AdminBottomNav(), AdminBottomNavProps, DeleteVideoDialog(), VideoListClient(), { main: mainItems, more: moreItems }, BottomNav(), BottomNavItem, BottomNavProps (+7 more)

### Community 47 - "AssessmentComparison.tsx"
Cohesion: 0.17
Nodes (20): AssessmentComparison(), AssessmentComparisonProps, ComparisonRow(), ComparisonRowProps, DeltaIndicator(), DeltaIndicatorProps, formatDate(), formatValue() (+12 more)

### Community 48 - "validations/shift-change-requests.ts"
Cohesion: 0.14
Nodes (23): adminCreateShiftAction(), adminEditShiftAction(), isMorningShiftAllowed(), ApprovalMode, detectShiftOverlap(), formatDate(), formatRequestSummary(), formatTime() (+15 more)

### Community 49 - "israel-time.ts"
Cohesion: 0.12
Nodes (21): endActiveShifts(), EXCLUDED_TRAINER_IDS, GET(), SweepResult, getAutoClockoutHour(), ISRAEL_DAY_FORMATTER, israelDateStr(), israelMinutesOfDay() (+13 more)

### Community 50 - "grow/route.ts"
Cohesion: 0.13
Nodes (16): POST(), customFieldsSchema, GrowWebhookData, growWebhookDataSchema, GrowWebhookPayload, growWebhookSchema, safeParseFloat(), safeParseInt() (+8 more)

### Community 51 - "SubmissionsContent.tsx"
Cohesion: 0.14
Nodes (18): ClickableTableRow(), ClickableTableRowProps, ShiftReportContent(), MentalContent(), NutritionContent(), nutritionStatusTranslations, PostWorkoutContent(), PostWorkoutWithTrainer (+10 more)

### Community 52 - "TrainerShiftsView.tsx"
Cohesion: 0.13
Nodes (21): EditShiftRequestDialogProps, ShiftFormDialogProps, ShiftFormTrainer, ShiftOtherPurposeDialog(), ShiftOtherPurposeDialogProps, aggregateByTrainer(), formatDate(), formatDuration() (+13 more)

### Community 53 - "progress-charts/index.ts"
Cohesion: 0.20
Nodes (20): AssessmentProgressCharts(), DATE_RANGE_PRESETS, METRIC_CATEGORIES, METRIC_DEFINITIONS, RATING_COLORS, RATING_LABELS_HE, calculateDelta(), calculatePercentileRankings() (+12 more)

### Community 54 - "TwoFactorSetup.tsx"
Cohesion: 0.15
Nodes (19): SecuritySettingsPage(), Step, TwoFactorSetup(), TwoFactorSetupProps, TwoFactorVerify(), TwoFactorVerifyProps, useMFA(), UseMFAReturn (+11 more)

### Community 55 - "ActivityLogRow.tsx"
Cohesion: 0.14
Nodes (19): ActivityLogRow(), ActivityLogRowProps, formatTimestamp(), formatValue(), getActionColor(), getActionIcon(), ActivityLogTable(), ActivityLogTableProps (+11 more)

### Community 56 - "ShiftRequestsAdminPanel.tsx"
Cohesion: 0.15
Nodes (20): RejectRequestDialog(), SHIFT_REQUEST_STATUS_LABELS, SHIFT_REQUEST_STATUS_VARIANTS, SHIFT_REQUEST_TYPE_LABELS, DATE_TIME_FMT, formatDateTime(), ShiftRequestDetailSheet(), ShiftRequestDetailSheetProps (+12 more)

### Community 57 - "UserDataTable.tsx"
Cohesion: 0.15
Nodes (16): getInitials(), TraineeImageSection(), TraineeImageSectionProps, formatPhone(), getInitials(), UserDataTable(), columns, UserTablePagination() (+8 more)

### Community 58 - "DrillCardForm.tsx"
Cohesion: 0.12
Nodes (16): DrillCardForm(), FAILURE_STEP_COLUMNS, FailureStepRow, failureStepToRow(), METRIC_COLUMNS, MetricRow, metricToRow(), phaseToFormRow() (+8 more)

### Community 59 - "player-report-html.ts"
Cohesion: 0.14
Nodes (19): ALL_METRIC_KEYS, buildMiniChartSvg(), buildPlayerReportHtml(), buildRadarSvg(), buildSingleValueCard(), CATEGORICAL_METRIC_KEYS, chip(), computeAge() (+11 more)

### Community 60 - "migrate-csv-assessments.ts"
Cohesion: 0.15
Nodes (21): AssessmentData, buildAssessmentData(), CSV_PATH, CsvRow, deduplicateNames(), DRY_RUN, envPath, extractNumber() (+13 more)

### Community 61 - "ShiftStatusCard.tsx"
Cohesion: 0.18
Nodes (18): ConnectionBanner(), ConnectionBannerProps, formatElapsed(), getHoursElapsed(), ShiftStatusCard(), ShiftStatusCardProps, ConnectionStatus, getOnlineSnapshot() (+10 more)

### Community 62 - "AppTopBar.tsx"
Cohesion: 0.12
Nodes (16): AppTopBar(), AppTopBarProps, emptySubscribe(), makeTitleResolver(), PageTitleResolver, DropdownMenu(), DropdownMenuCheckboxItem(), DropdownMenuContent() (+8 more)

### Community 63 - "workouts/lib/types.ts"
Cohesion: 0.18
Nodes (14): GridCell(), GridCellProps, ProgramGrid(), ProgramGridProps, copyCellAcrossWeeks(), deriveSubCategories(), emptyCell(), resizeRowCells() (+6 more)

### Community 64 - "login/page.tsx"
Cohesion: 0.19
Nodes (11): GET(), LoginForm(), Verify2FAPage(), VerifyPage(), extractCode(), extractMessage(), getOtpErrorMessage(), MESSAGE_PATTERNS (+3 more)

### Community 65 - "ReportEditor.tsx"
Cohesion: 0.18
Nodes (16): PlayerReportPdfButton(), PlayerReportPdfButtonProps, ReportAssessmentsTable(), BulletItem, ReportBulletList(), AssessmentProgressCharts, RadarStatsChart, ReportChartsSection() (+8 more)

### Community 66 - "trainee-notes.ts"
Cohesion: 0.13
Nodes (16): CategorizedNotes, categorizeNotes(), SOCIAL_CATEGORIES, STRENGTH_CATEGORIES, WEAKNESS_CATEGORIES, mockNotes, CoveredPerTrainee, PerTraineeColumns (+8 more)

### Community 67 - "programs.ts"
Cohesion: 0.14
Nodes (18): ActionResult, createProgram(), getProgramForEdit(), listPrograms(), mapCell(), mapProgram(), RawProgramCell, RawProgramExercise (+10 more)

### Community 68 - "components.json"
Cohesion: 0.11
Nodes (18): aliases, components, hooks, lib, ui, utils, iconLibrary, registries (+10 more)

### Community 69 - "[formId]/page.tsx"
Cohesion: 0.13
Nodes (12): calcAge(), formatDate(), FormDetailPage(), FormDetailPageProps, FormType, formTypeConfig, NutritionFields(), NutritionFormWithProfile (+4 more)

### Community 70 - "whatsapp/client.ts"
Cohesion: 0.22
Nodes (11): GET(), callWhatsAppAPI(), getConfig(), WhatsAppConfig, WhatsAppResult, sendFlowInteractive(), sendFlowTemplate(), sendTextMessage() (+3 more)

### Community 71 - "ClipUploadCard.tsx"
Cohesion: 0.20
Nodes (14): ClipUploadCard(), ClipUploadCardProps, MAX_MB, clipDaysRemaining(), clipExpiresAt(), ALLOWED_CLIP_MIME_TYPES, AllowedClipMimeType, buildClipPath() (+6 more)

### Community 72 - "shift-queue.ts"
Cohesion: 0.26
Nodes (18): clearExpiredActions(), clearProcessedFromLocalStorage(), clearQueue(), dequeueShiftAction(), enqueueShiftAction(), generateId(), idbClear(), idbDelete() (+10 more)

### Community 74 - "create/route.ts"
Cohesion: 0.20
Nodes (14): POST(), approveTransaction(), ApproveTransactionRequest, ApproveTransactionResponse, createPaymentProcess(), CreatePaymentRequest, CreatePaymentResponse, fetchWithRetry() (+6 more)

### Community 75 - "pdf/route.ts"
Cohesion: 0.15
Nodes (14): ALLOWED_AVATAR_TYPES, fetchAvatarAsBase64(), maxDuration, POST(), runtime, playerAssessmentSchema, PlayerReportPdfBody, playerReportPdfBodySchema (+6 more)

### Community 76 - "actions/next-game.ts"
Cohesion: 0.18
Nodes (14): NextGameForm(), NextGameFormProps, NextGameFormPage(), ActionResult, getOwnNextGame(), getTraineeUserId(), NextGameRow, upsertNextGame() (+6 more)

### Community 77 - "security/page.tsx"
Cohesion: 0.29
Nodes (13): ActionResult, DeleteConfirmDialogProps, MoveToChurnedButtonProps, AlertDialog(), AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription() (+5 more)

### Community 78 - "Profile"
Cohesion: 0.15
Nodes (17): AssessmentDetailDialogProps, AssessmentsContentProps, AssessmentSectionPopoverProps, AssessmentsTableProps, DeleteUserDialogProps, UserActionsCardProps, UserDataTableProps, formatDate() (+9 more)

### Community 80 - "flow/route.ts"
Cohesion: 0.28
Nodes (15): ageSelectionScreen(), extractPhoneFromToken(), frequencySelectionScreen(), handleBack(), handleDataExchange(), handleInit(), POST(), saveFlowField() (+7 more)

### Community 81 - "RatingTrendChart.tsx"
Cohesion: 0.15
Nodes (11): MiniRatingChartWrapperProps, MiniRatingChart(), MiniRatingChartProps, RadarStatsChart(), RadarStatsChartProps, STAT_KEYS, ALL_STATS, RatingStat (+3 more)

### Community 82 - "RetentionTable.tsx"
Cohesion: 0.21
Nodes (12): ChurnedCustomerRowInner(), MoveToChurnedButton(), RetentionNoteCell(), formatDate(), getMonthName(), getNoteKey(), RetentionTable(), HEBREW_MONTHS (+4 more)

### Community 83 - "ExerciseTable.tsx"
Cohesion: 0.15
Nodes (12): TableToolbarProps, ToolbarCheckboxProps, ToolbarDateRangeProps, ToolbarSelectProps, ExerciseFormProps, ExercisePickerProps, ALL_MAIN_CATEGORIES_OPTION, ALL_SUB_CATEGORIES_OPTION (+4 more)

### Community 84 - "get-achievements.ts"
Cohesion: 0.25
Nodes (14): AchievementCelebrationClient(), AchievementCelebrationClientProps, useAchievementCelebration(), getMyAchievements(), getUncelebratedAchievements(), getUserAchievements(), markAchievementCelebrated(), markAchievementsCelebrated() (+6 more)

### Community 85 - "ranking-utils.ts"
Cohesion: 0.23
Nodes (12): metadata, RankingsPage(), RankingsView, createEmptyRankingsData(), getRankingsData(), calculateGroupStatistics(), calculateMedian(), calculateRankings() (+4 more)

### Community 86 - "onboarding-tour/index.ts"
Cohesion: 0.23
Nodes (9): OnboardingTourProvider(), OnboardingTourProviderProps, TourTriggerButton(), TourTriggerButtonProps, useOnboardingTour(), UseOnboardingTourOptions, completeTour(), resetTour() (+1 more)

### Community 87 - "pdf-player-report-template.tsx"
Cohesion: 0.18
Nodes (11): compareMetric(), ComparisonResult, getMetricDirection(), HIGHER_IS_BETTER, LOWER_IS_BETTER, MetricDirection, C, METRIC_KEYS (+3 more)

### Community 88 - "devDependencies"
Cohesion: 0.15
Nodes (15): @axe-core/playwright, devDependencies, @axe-core/playwright, @tailwindcss/postcss, @testing-library/dom, @testing-library/jest-dom, @testing-library/react, tw-animate-css (+7 more)

### Community 90 - "TraineeImageUpload.tsx"
Cohesion: 0.17
Nodes (12): ACCEPTED_TYPES, COMPRESSION_OPTIONS, TraineeImageUpload(), TraineeImageUploadProps, UploadStep, Progress, ProgressProps, BackgroundRemovalResult (+4 more)

### Community 91 - "VideoTableColumns.tsx"
Cohesion: 0.19
Nodes (11): columns, getYouTubeEmbedUrl(), getYouTubeId(), getYouTubeThumbnail(), ThumbnailQuality, dayTopicSuggestions, getDayTopicSuggestion(), VideoFormInput (+3 more)

### Community 92 - "nutrition/[userId]/page.tsx"
Cohesion: 0.20
Nodes (11): PageProps, SleepChart, MeasurementsCard(), MeasurementsCardProps, MeasurementsTableProps, RecommendationForm(), RecommendationFormProps, UserEditFormProps (+3 more)

### Community 93 - "trainer-shifts.ts"
Cohesion: 0.27
Nodes (10): POST(), SyncAction, ActionResult, clockInAction(), MAX_SHIFT_HOURS, inferShiftPeriod(), isSaturdayInIsrael(), resolveTimestamp() (+2 more)

### Community 94 - "NutritionTable.tsx"
Cohesion: 0.23
Nodes (11): NutritionTable(), NutritionTableProps, planFilterOptions, recFilterOptions, Trainee, matchesPositionFilter(), POSITION_FILTER_ALL, POSITION_FILTER_NONE (+3 more)

### Community 95 - "dependencies"
Cohesion: 0.15
Nodes (13): browser-image-compression, dependencies, browser-image-compression, @radix-ui/react-tabs, @radix-ui/react-tooltip, recharts, tailwind-merge, use-debounce (+5 more)

### Community 96 - "scripts"
Cohesion: 0.15
Nodes (13): scripts, build, dev, lint, prepare, seed:workouts, start, test (+5 more)

### Community 97 - "CommunicationHistoryCard.tsx"
Cohesion: 0.27
Nodes (10): CommunicationHistoryCard(), CommunicationHistoryCardProps, ActionResult, addCommunicationNote(), CommunicationNote, deleteCommunicationNote(), getCommunicationNotes(), AddCommunicationNoteInput (+2 more)

### Community 98 - "validations/profile.ts"
Cohesion: 0.18
Nodes (11): ProfilePersonalForm(), updateOwnProfileAction(), ACCEPTED_IMAGE_TYPES, IMAGE_CONSTRAINTS, OnboardingData, onboardingSchema, ProfileCompletionData, profileCompletionSchema (+3 more)

### Community 99 - "progress-charts/lib/utils/index.ts"
Cohesion: 0.26
Nodes (8): DateRangeFilterProps, useDateRangeFilter(), calculateDateFromPreset(), filterByDateRange(), getPercentileColor(), DateRange, DateRangePreset, calculatePercentile()

### Community 100 - "shared/index.ts"
Cohesion: 0.18
Nodes (14): bulkCreateUsersAction(), BulkImportResult, ActionResult, createUserAction(), ActionResult, softDeleteUserAction(), ActionResult, updateUserAction() (+6 more)

### Community 101 - "parse-leads-paste.ts"
Cohesion: 0.21
Nodes (10): FieldKey, HEADER_ALIASES, normalizeHeaderCell(), ParsedLeadRow, ParseLeadError, parseLeadsPaste(), ParseLeadsResult, POSITIONAL_FIELDS (+2 more)

### Community 102 - "manifest.json"
Cohesion: 0.17
Nodes (11): background_color, description, dir, display, icons, lang, name, orientation (+3 more)

### Community 103 - "SubmissionExportButton.tsx"
Cohesion: 0.24
Nodes (11): AnySubmission, formatDateForFilename(), formatDateHebrew(), formTypeToHebrew(), PostWorkoutWithTrainer, SubmissionExportButton(), SubmissionExportButtonProps, transformToCSV() (+3 more)

### Community 104 - "useFormDraft.ts"
Cohesion: 0.35
Nodes (9): getKey(), hasMeaningfulData(), loadDraft(), removeDraft(), saveDraft(), Draft, DraftMetadata, UseFormDraftOptions (+1 more)

### Community 105 - "import-season-prep-leads.ts"
Cohesion: 0.22
Nodes (10): apply, env, envContent, LeadRecord, main(), normalizeLeadPhone(), normName(), SELLER_TO_TRAINER_NAME (+2 more)

### Community 106 - "relink-arbox-and-backfill-birthdates.ts"
Cohesion: 0.25
Nodes (10): ArboxBirthdayEntry, ArboxUser, CURRENT_YEAR, envContent, envPath, fetchAllArboxUsers(), fetchAllBirthdays(), main() (+2 more)

### Community 107 - "seed-fitness-kondos.ts"
Cohesion: 0.20
Nodes (10): AgeRowSeed, COLOR_CODE_POINTS, DrillSeed, main(), Metric, PARAM_1, PARAM_2, PARAMS (+2 more)

### Community 108 - "reports.ts"
Cohesion: 0.27
Nodes (8): ARBOX_BASE_URL, ARBOX_MAX_PAGES, ARBOX_PAGE_LIMIT, ArboxReportResponse, calculateWeeklyAverage(), EntranceReportEntry, fetchEntranceReport(), fetchEntranceReportPage()

### Community 109 - "migrate-jan26.ts"
Cohesion: 0.29
Nodes (9): env, envContent, main(), normalizeJump(), parseCSVLine(), ParsedRow, parseKaiser(), parseNum() (+1 more)

### Community 110 - "ProgramBuilder.tsx"
Cohesion: 0.27
Nodes (8): metadata, PageProps, ProgramBuilderPage(), metaFromProgram(), ProgramBuilder(), ProgramBuilderProps, ProgramMeta, ProgramGrid

### Community 111 - "app/layout.tsx"
Cohesion: 0.24
Nodes (6): bebasNeue, heebo, metadata, viewport, ServiceWorkerRegistration(), Toaster()

### Community 112 - "user-import.ts"
Cohesion: 0.29
Nodes (8): UserImportDialog(), columnMapping, csvRowSchema, CSVUserRow, CSVValidationResult, normalizeCSVRow(), roleMapping, userRoles

### Community 113 - "wcag.ts"
Cohesion: 0.36
Nodes (8): BRAND, contrastRatio(), hexToRgb(), meetsAA(), meetsAAA(), relativeLuminance(), Rgb, srgbToLinear()

### Community 114 - "package.json"
Cohesion: 0.22
Nodes (8): engines, node, lint-staged, *.{ts,tsx}, name, private, version, eslint --fix

### Community 115 - "backfill-birthdates-from-age.ts"
Cohesion: 0.28
Nodes (8): ArboxReportResponse, ArboxUser, CURRENT_YEAR, envContent, envPath, fetchAllArboxUsers(), fetchAllClientsPage(), main()

### Community 116 - "verify-shift-changes.ts"
Cohesion: 0.33
Nodes (8): durationHM(), env, envContent, findTrainer(), fmtIL(), getShifts(), main(), supabase

### Community 117 - "upload/route.ts"
Cohesion: 0.33
Nodes (6): POST(), AVATARS_BUCKET, cleanupUploadedFiles(), UploadOptions, UploadResult, uploadToStorage()

### Community 118 - "WorkoutVideo"
Cohesion: 0.25
Nodes (8): DeleteVideoDialogProps, VideoDataTableProps, VideoFormProps, VideoListClientProps, VideoTablePagination(), VideoTablePaginationProps, VideoCardProps, WorkoutVideo

### Community 119 - "arbox-sync-birthdays.ts"
Cohesion: 0.32
Nodes (7): BirthdayEntry, BirthdayResponse, envContent, envPath, fetchAllBirthdays(), fetchBirthdayPage(), main()

### Community 120 - "migrate-d1-to-supabase.ts"
Cohesion: 0.25
Nodes (6): D1ContactLog, D1Export, D1FlowResponse, D1Lead, D1SentMessage, envPath

### Community 121 - "parse-churned-paste.ts"
Cohesion: 0.32
Nodes (6): PasteChurnedDialog(), normalizeDate(), ParseChurnedError, parseChurnedPaste(), ParseChurnedResult, ParsedChurnedRow

### Community 122 - "MyShiftRequestsList.tsx"
Cohesion: 0.36
Nodes (7): DATE_FMT, formatDate(), formatTime(), MyShiftRequestsList(), MyShiftRequestsListProps, TIME_FMT, MyShiftChangeRequest

### Community 123 - "fix-phone-format.ts"
Cohesion: 0.33
Nodes (6): dryRun, ensurePlus(), env, envContent, main(), supabase

### Community 124 - "restore-may-retention.ts"
Cohesion: 0.38
Nodes (6): APPLY, extractData(), inputPath, isValid(), main(), RetentionData

### Community 125 - "seed-drill-cards.ts"
Cohesion: 0.48
Nodes (6): DraftCard, DRY_RUN, insertCard(), main(), n(), validateCard()

### Community 126 - "PhysicalMetricChart.tsx"
Cohesion: 0.43
Nodes (5): PhysicalMetricChart(), PhysicalMetricChartProps, calculateTrend(), getTrendColor(), PhysicalMetricChartData

### Community 127 - "profile.test.ts"
Cohesion: 0.48
Nodes (4): getMissingRequiredFields(), getProfileCompletionPercentage(), isProfileComplete(), PROFILE_FIELD_LABELS_HE

### Community 128 - "sw.js"
Cohesion: 0.67
Nodes (5): idbDelete(), idbGetAll(), notifyClients(), openIDB(), processShiftQueue()

### Community 129 - "backfill-birthdates-from-csv.ts"
Cohesion: 0.40
Nodes (5): CURRENT_YEAR, envContent, envPath, main(), normalizeName()

### Community 130 - "debug-matched-profiles.ts"
Cohesion: 0.40
Nodes (5): apiKey, envContent, envPath, main(), normalizePhone()

### Community 131 - "debug-with-birthdates.ts"
Cohesion: 0.40
Nodes (5): apiKey, envContent, envPath, main(), normalizePhone()

### Community 132 - "env.ts"
Cohesion: 0.33
Nodes (3): register(), optionalServerVars, requiredServerVars

### Community 133 - "rate-limit.ts"
Cohesion: 0.47
Nodes (4): createRedisClient(), isAdminExempt(), RateLimitResult, redis

### Community 134 - "cleanup-trainees.ts"
Cohesion: 0.40
Nodes (3): env, envContent, supabase

### Community 135 - "debug-arbox-ids.ts"
Cohesion: 0.40
Nodes (3): apiKey, envContent, envPath

### Community 136 - "src/middleware.ts"
Cohesion: 0.60
Nodes (3): updateSession(), config, middleware()

### Community 137 - "workouts/layout.tsx"
Cohesion: 0.50
Nodes (3): TABS, WorkoutsLayout(), WorkoutsTab

## Knowledge Gaps
- **800 isolated node(s):** `supabase`, `$schema`, `style`, `rsc`, `tsx` (+795 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **63 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `dependencies` to `cn`, `class-variance-authority`, `clsx`, `framer-motion`, `@hookform/resolvers`, `html-to-image`, `@huggingface/transformers`, `lucide-react`, `next`, `next-themes`, `nuqs`, `papaparse`, `puppeteer-core`, `radix-ui`, `@radix-ui/react-accordion`, `@radix-ui/react-alert-dialog`, `@radix-ui/react-avatar`, `@radix-ui/react-checkbox`, `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-label`, `@radix-ui/react-select`, `@radix-ui/react-separator`, `@radix-ui/react-slot`, `@radix-ui/react-switch`, `react-dom`, `react-hook-form`, `react-icons`, `@react-pdf/renderer`, `sonner`, `@sparticuz/chromium`, `@supabase/ssr`, `@supabase/supabase-js`, `@tanstack/react-table`, `@upstash/ratelimit`, `@upstash/redis`, `@vercel/analytics`, `@vercel/functions`, `@vercel/speed-insights`, `zod`, `driver.js`, `package.json`?**
  _High betweenness centrality (0.086) - this node is a cross-community bridge._
- **Why does `react` connect `cn` to `AssessmentStepContent.tsx`, `dependencies`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **Why does `cn()` connect `cn` to `AssessmentStepContent.tsx`, `LeadDetailSheet.tsx`, `button.tsx`, `card.tsx`, `workouts/layout.tsx`, `SetGoalDialog.tsx`, `LeaderboardTable.tsx`, `development-book/lib/types.ts`, `CardHeader`, `RetentionPageClient.tsx`, `nutrition/index.ts`, `dashboard/page.tsx`, `AssessmentsMonthView.tsx`, `admin-lead-tabs.ts`, `DrillCard.tsx`, `PlayerStatsDetail.tsx`, `AssessmentForm.tsx`, `AdminSidebar.tsx`, `achievements/index.ts`, `shifts/page.tsx`, `ParameterForm.tsx`, `utils.ts`, `AssessmentComparison.tsx`, `UserDataTable.tsx`, `DrillCardForm.tsx`, `AppTopBar.tsx`, `security/page.tsx`, `RatingTrendChart.tsx`, `TraineeImageUpload.tsx`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **What connects `supabase`, `$schema`, `style` to the rest of the system?**
  _800 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `AssessmentStepContent.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06525252525252526 - nodes in this community are weakly interconnected._
- **Should `LeadDetailSheet.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.05078929306794784 - nodes in this community are weakly interconnected._
- **Should `createClient` be split into smaller, more focused modules?**
  _Cohesion score 0.06218487394957983 - nodes in this community are weakly interconnected._