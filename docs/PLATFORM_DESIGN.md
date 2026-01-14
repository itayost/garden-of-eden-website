# Garden of Eden - Platform Design Document

> **Document Purpose**: Comprehensive planning document covering user flows, feature requirements, and UI/UX specifications for the soccer academy platform.

---

## Table of Contents
1. [Current State Summary](#1-current-state-summary)
2. [User Personas](#2-user-personas)
3. [User Flows](#3-user-flows)
4. [Feature Requirements](#4-feature-requirements)
5. [UI/UX Specifications](#5-uiux-specifications)
6. [Gap Analysis & Priorities](#6-gap-analysis--priorities)
7. [Implementation Roadmap](#7-implementation-roadmap)

---

## 1. Current State Summary

### What Exists Today

| Feature Area | Trainee | Trainer/Admin |
|-------------|---------|---------------|
| Authentication | OTP login (email/phone) | Same |
| Dashboard | Stats overview, player card, quick actions | Aggregate stats, recent activity |
| Forms | Pre-workout, post-workout, nutrition (one-time) | View all submissions (read-only) |
| Videos | 5-day program with progress tracking | CRUD management |
| Assessments | View own assessment history | Create/edit for any player |
| Player Card | Auto-generated from assessments | Manual editor available |
| User Management | View own profile | View user list (read-only) |

### What's Missing (Key Gaps)

**Onboarding**
- [x] ~~No profile completion flow (birthdate, position, goals)~~ ✅ DONE - Profile completion implemented
- [ ] No welcome wizard or guided tour
- [ ] No clear "Join Academy" CTA on landing page

**Progress & Feedback**
- [ ] No trend visualizations (charts/graphs over time)
- [ ] No goal setting or target tracking
- [ ] No comparison to peers (percentile rankings)
- [ ] No achievement/gamification system

**Communication**
- [ ] No messaging between trainers and trainees
- [ ] No notifications when assessments added
- [ ] No feedback loop on forms

**Admin Tools**
- [ ] No user editing (roles, details)
- [ ] No filtering, search, or export
- [ ] No analytics dashboard

---

## 2. User Personas

### Persona 1: **Trainee (שחקן)**
**Who**: Youth soccer players (ages 8-18) and their parents
**Goals**:
- Track physical progress
- Complete required forms before/after training
- Watch workout videos
- See their "FIFA card" rating
- Understand where they need to improve

**Pain Points Today**:
- Can't see progress over time (no graphs)
- Don't know what metrics mean
- No personalized feedback from trainers
- Forms are tedious, no draft saving

### Persona 2: **Trainer (מאמן)**
**Who**: Academy coaches who run training sessions
**Goals**:
- Record player physical assessments efficiently
- Track which players completed forms
- Identify players needing attention (injuries, declining performance)
- Communicate feedback to players

**Pain Points Today**:
- Assessment form has all tests on one page (too long)
- No quick view of who needs assessments
- Can't easily compare players
- No way to message players

### Persona 3: **Admin (מנהל)**
**Who**: Academy management
**Goals**:
- Overview of entire program
- User management (roles, access)
- Analytics and reporting
- Export data for reports

**Pain Points Today**:
- Can't edit user roles
- No analytics or graphs
- Can't export data
- No filtering in tables

---

## 3. User Flows

### 3.1 New User Onboarding

```
┌─────────────────────────────────────────────────────────────────────┐
│                        NEW USER FLOW (Proposed)                     │
└─────────────────────────────────────────────────────────────────────┘

[Landing Page]
    │
    ▼ Click "הצטרפו לאקדמיה"
[Login Page] (/auth/login)
    │ Enter email or phone
    ▼
[OTP Verification] (/auth/verify)
    │ Enter 6-digit code
    ▼
[Profile Completion] (/onboarding/profile) ← NEW
    │ • Full name
    │ • Birthdate (for age group)
    │ • Preferred position
    │ • Profile photo (optional)
    ▼
[Welcome Tour] (/onboarding/tour) ← NEW (Optional)
    │ • Quick intro to features
    │ • Highlight key actions
    ▼
[Nutrition Form Prompt]
    │ "Complete before first training"
    ▼
[Dashboard] (/dashboard)
    │ • Onboarding checklist shown
    │ • "Complete profile" if needed
```

**Current Flow** (for comparison):
```
[Login] → [OTP] → [Dashboard with nutrition alert]
```

### 3.2 Pre-Training Flow (Trainee)

```
┌─────────────────────────────────────────────────────────────────────┐
│                     PRE-TRAINING FLOW                               │
└─────────────────────────────────────────────────────────────────────┘

[Dashboard]
    │ Morning of training day
    ▼
[Pre-Workout Form] (/dashboard/forms/pre-workout)
    │ Fields: sleep, hydration, injuries, readiness
    │
    │ Improvements:
    │ • Auto-save draft
    │ • Pre-fill name/age from profile
    │ • Smart defaults from history
    │ • Injury flag triggers trainer notification ← NEW
    ▼
[Confirmation]
    │ "Ready for training!"
    │ Show relevant workout videos for today
    ▼
[Optional: Watch Videos]
    │ (/dashboard/videos)
```

### 3.3 Post-Training Flow (Trainee)

```
┌─────────────────────────────────────────────────────────────────────┐
│                     POST-TRAINING FLOW                              │
└─────────────────────────────────────────────────────────────────────┘

[Training Ends]
    │
    ▼
[Notification/Prompt] ← NEW
    │ "How was your training?"
    ▼
[Post-Workout Form] (/dashboard/forms/post-workout)
    │ Fields: trainer, difficulty, satisfaction, comments
    │
    │ Improvements:
    │ • Slider UX for ratings
    │ • Emoji feedback options
    │ • Quick submit (minimal fields)
    ▼
[Confirmation + Streak Counter] ← NEW
    │ "Great job! 🎉 5 training days in a row!"
```

### 3.4 Physical Assessment Flow (Trainer)

```
┌─────────────────────────────────────────────────────────────────────┐
│               ASSESSMENT FLOW (Current vs Proposed)                 │
└─────────────────────────────────────────────────────────────────────┘

CURRENT:
[Select Player] → [Single Long Form with all 20+ fields] → [Submit]

PROPOSED (Step-by-Step):
[Select Player]
    ▼
[Assessment Hub] (/admin/assessments/[userId])
    │ Show player card + history
    ▼
[Start New Assessment]
    │
    ├─── [Step 1: Date Selection]
    │    Choose assessment date
    │
    ├─── [Step 2: Sprint Tests] ← Individual category
    │    5m, 10m, 20m
    │    [Save & Continue] [Skip]
    │
    ├─── [Step 3: Jump Tests]
    │    2-leg distance, right/left leg, height
    │    [Save & Continue] [Skip]
    │
    ├─── [Step 4: Agility & Flexibility]
    │    Blaze spot, ankle/knee/hip
    │    [Save & Continue] [Skip]
    │
    ├─── [Step 5: Physical Assessments]
    │    Coordination, leg power, body structure
    │    [Save & Continue] [Skip]
    │
    ├─── [Step 6: Power Tests]
    │    Kick power (Kaiser)
    │    [Save & Continue] [Skip]
    │
    └─── [Step 7: Mental Notes]
         Concentration, decision making, etc.
         [Finish Assessment]

Benefits:
• Can complete one category at a time (different testing days)
• Data saved after each step (no data loss)
• Progress indicator shows completion
• Skip tests you don't have equipment for
```

### 3.5 Viewing Progress (Trainee)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PROGRESS VIEW FLOW (Proposed)                    │
└─────────────────────────────────────────────────────────────────────┘

[Dashboard]
    │ Click player card
    ▼
[My Progress] (/dashboard/progress) ← NEW
    │
    ├─── [Player Card]
    │    Current overall rating
    │    Position, age group
    │
    ├─── [Progress Charts] ← NEW
    │    • Sprint times over 6 months (line chart)
    │    • Jump distances over time
    │    • Overall rating trend
    │
    ├─── [Recent Assessments]
    │    Last 3 assessments with comparison
    │    "↑ 0.2s faster in 5m sprint"
    │
    ├─── [Goals] ← NEW
    │    • Target sprint time: 1.2s
    │    • Progress: 75%
    │
    └─── [Age Group Ranking] ← NEW
         "Top 20% in U12 for sprint speed"
```

### 3.6 Admin Analytics Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ADMIN ANALYTICS FLOW (Proposed)                  │
└─────────────────────────────────────────────────────────────────────┘

[Admin Dashboard]
    │
    ├─── [Overview Cards]
    │    Total users, forms, assessments
    │    Trend indicators (↑↓)
    │
    ├─── [Analytics Tab] ← NEW
    │    │
    │    ├── Form Completion Rates (chart)
    │    ├── Active Users This Week (chart)
    │    ├── Assessment Coverage by Age Group
    │    └── Injury Reports This Month
    │
    ├─── [Alerts Panel] ← NEW
    │    • "3 players reported injuries today"
    │    • "5 players haven't logged in 2 weeks"
    │    • "U12 group needs assessments"
    │
    └─── [Quick Actions]
         • Export all data
         • Send bulk notification
         • View attendance
```

---

## 4. Feature Requirements

### 4.1 Assessment System (Priority: HIGH)

#### FR-ASS-001: Step-by-Step Assessment Entry ✅ DONE
**Description**: Allow trainers to fill assessments one category at a time
**Requirements**:
- [x] 7 steps: Date → Sprints → Jumps → Agility → Physical → Power → Mental
- [x] Save after each step (persist to database)
- [x] Allow skipping categories
- [x] Show progress indicator (e.g., "Step 3 of 7")
- [ ] Resume incomplete assessments (partial - form saves on submit)
- [ ] Show previous values for comparison while filling

#### FR-ASS-002: Assessment Comparison View
**Description**: Show changes between assessments
**Requirements**:
- [ ] Side-by-side comparison of 2 assessments
- [ ] Highlight improvements (green) and regressions (red)
- [ ] Calculate deltas (e.g., "-0.15s in 5m sprint")

#### FR-ASS-003: Progress Charts
**Description**: Visualize metrics over time
**Requirements**:
- [ ] Line charts for numeric metrics (sprints, jumps)
- [ ] Bar charts for categorical changes
- [ ] Date range filter
- [ ] Export chart as image

### 4.2 User Management (Priority: HIGH)

#### FR-USR-001: Profile Completion ✅ DONE
**Description**: Collect required user information
**Requirements**:
- [x] Onboarding flow after first login
- [x] Required fields: full name, birthdate
- [x] Optional fields: position, profile photo
- [x] Prompt to complete if profile incomplete (middleware + layout redirect)

#### FR-USR-002: Admin User Editing
**Description**: Allow admins to manage users
**Requirements**:
- [ ] Edit user details (name, phone, birthdate)
- [ ] Change user roles (trainee ↔ trainer ↔ admin)
- [ ] Deactivate/reactivate users
- [ ] View user activity history

### 4.3 Forms System (Priority: MEDIUM)

#### FR-FRM-001: Draft Saving
**Description**: Auto-save form progress
**Requirements**:
- [ ] Save to localStorage every 10 seconds
- [ ] Restore draft on page load
- [ ] Clear draft after successful submission
- [ ] Warning if navigating away with unsaved changes

#### FR-FRM-002: Form Edit Capability
**Description**: Allow editing submitted forms (within time limit)
**Requirements**:
- [ ] Edit button on recent submissions (last 24 hours)
- [ ] Audit log of changes
- [ ] Trainer can request re-submission

### 4.4 Progress & Gamification (Priority: MEDIUM)

#### FR-PRG-001: Streak Tracking
**Description**: Track consecutive training days
**Requirements**:
- [ ] Count consecutive days with form submissions
- [ ] Display streak on dashboard
- [ ] Celebration animation for milestones (7, 30, 100 days)

#### FR-PRG-002: Achievement Badges
**Description**: Reward accomplishments
**Requirements**:
- [ ] Badge for completing nutrition form
- [ ] Badge for watching all videos
- [ ] Badge for first assessment
- [ ] Badge for improvement milestones

#### FR-PRG-003: Goals System
**Description**: Set and track personal goals
**Requirements**:
- [ ] Trainer can set goals per player
- [ ] Player can see their goals
- [ ] Progress bar toward each goal
- [ ] Notification when goal achieved

### 4.5 Communication (Priority: MEDIUM)

#### FR-COM-001: Notifications System
**Description**: Alert users of important events
**Requirements**:
- [ ] New assessment notification (trainee)
- [ ] Injury report alert (trainer)
- [ ] Incomplete profile reminder
- [ ] Training day reminder

#### FR-COM-002: Trainer Notes/Feedback
**Description**: Allow trainers to send feedback
**Requirements**:
- [ ] Note attached to assessment visible to trainee
- [ ] Quick feedback on form submissions
- [ ] Trainee can acknowledge feedback

### 4.6 Analytics & Reporting (Priority: LOW)

#### FR-ANL-001: Admin Dashboard Analytics
**Description**: Aggregate insights for admins
**Requirements**:
- [ ] Form completion rates chart
- [ ] User activity heatmap
- [ ] Assessment coverage by age group
- [ ] Exportable reports (CSV, PDF)

#### FR-ANL-002: Age Group Comparisons
**Description**: Compare players within age groups
**Requirements**:
- [ ] Leaderboard by metric (sprint, jump, etc.)
- [ ] Percentile rankings
- [ ] Group averages and distribution

---

## 5. UI/UX Specifications

### 5.1 Design Principles

1. **Hebrew-First**: RTL layout, all text in Hebrew
2. **Mobile-First**: Most users access from phones
3. **Dark Theme**: Green/black gradient (Garden of Eden branding)
4. **Gamified**: FIFA-style cards, progress bars, achievements
5. **Accessible**: Large touch targets, clear contrast, readable fonts

### 5.2 Screen Specifications

#### Dashboard (Trainee) - Current + Proposed Changes

```
┌────────────────────────────────────────────────────────────────┐
│ HEADER: Logo | Navigation (ראשי, מבדקים, שאלונים, סרטונים) | User│
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ WELCOME SECTION                                         │  │
│  │ "שלום, [שם]! 👋"                                        │  │
│  │ [Streak Badge: 🔥 5 ימים רצופים]  ← NEW                │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌────────────────┐  ┌────────────────────────────────────┐  │
│  │  PLAYER CARD   │  │  QUICK ACTIONS (2x2 grid)         │  │
│  │  [FIFA Style]  │  │  ┌─────────┐ ┌─────────┐          │  │
│  │   OVR: 75      │  │  │Pre-Work │ │Post-Work│          │  │
│  │   Pace: 82     │  │  └─────────┘ └─────────┘          │  │
│  │   etc...       │  │  ┌─────────┐ ┌─────────┐          │  │
│  │                │  │  │Nutrition│ │ Videos  │          │  │
│  │ [View Details] │  │  │   ✓     │ │ 12/20   │          │  │
│  └────────────────┘  │  └─────────┘ └─────────┘          │  │
│                      └────────────────────────────────────┘  │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ PROGRESS OVERVIEW ← NEW                                 │  │
│  │ ┌──────────────────────────────────────────────────┐   │  │
│  │ │ [Mini Line Chart: Overall Rating Last 6 Months]  │   │  │
│  │ └──────────────────────────────────────────────────┘   │  │
│  │ "השתפרת ב-5 נקודות מאז ינואר!"                        │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ STATS SUMMARY                                           │  │
│  │ [Form Icon] 15 | [Video Icon] 12/20 | [Assessment] 3   │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

#### Step-by-Step Assessment (Trainer) - NEW

```
┌────────────────────────────────────────────────────────────────┐
│ HEADER: [← חזרה] | מבדק חדש עבור [שם שחקן] | [שמור ויציאה]    │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ PROGRESS BAR                                            │  │
│  │ ○──●──○──○──○──○──○                                     │  │
│  │ תאריך ספרינט ניתור זריזות הערכות כוח מנטלי              │  │
│  │        ↑                                                │  │
│  │     שלב 2/7                                             │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ CURRENT STEP: מבדקי ספרינט                              │  │
│  │                                                         │  │
│  │  ספרינט 5 מטר                                          │  │
│  │  ┌───────────────────────────────┐                     │  │
│  │  │ [   1.25    ] שניות           │  אחרון: 1.32      │  │
│  │  └───────────────────────────────┘                     │  │
│  │                                                         │  │
│  │  ספרינט 10 מטר                                         │  │
│  │  ┌───────────────────────────────┐                     │  │
│  │  │ [   2.15    ] שניות           │  אחרון: 2.28      │  │
│  │  └───────────────────────────────┘                     │  │
│  │                                                         │  │
│  │  ספרינט 20 מטר                                         │  │
│  │  ┌───────────────────────────────┐                     │  │
│  │  │ [   3.85    ] שניות           │  אחרון: 4.02      │  │
│  │  └───────────────────────────────┘                     │  │
│  │                                                         │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ NAVIGATION                                              │  │
│  │ [← הקודם]    [דלג על שלב זה]    [המשך →]               │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

#### Progress View (Trainee) - NEW

```
┌────────────────────────────────────────────────────────────────┐
│ HEADER: Navigation | ההתקדמות שלי                              │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌────────────────┐  ┌────────────────────────────────────┐  │
│  │  PLAYER CARD   │  │  OVERALL TREND                     │  │
│  │  [Large Size]  │  │  ┌─────────────────────────────┐   │  │
│  │   OVR: 75      │  │  │ 80┤        ____/            │   │  │
│  │   ↑ 5 pts      │  │  │ 70┤   ____/                 │   │  │
│  │                │  │  │ 60┤__/                      │   │  │
│  │                │  │  │   └───┬───┬───┬───┬───┬───  │   │  │
│  │                │  │  │      ינו פבר מרץ אפר מאי     │   │  │
│  │                │  │  └─────────────────────────────┘   │  │
│  └────────────────┘  └────────────────────────────────────┘  │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ STAT BREAKDOWN                                          │  │
│  │                                                         │  │
│  │ [Tab: מהירות] [Tab: קפיצות] [Tab: גמישות] [Tab: כוח]  │  │
│  │                                                         │  │
│  │ ┌──────────────────────────────────────────────────┐   │  │
│  │ │ SPRINT TIMES CHART                               │   │  │
│  │ │                                                  │   │  │
│  │ │  5m:  ●─────●───────●──────●  (1.32→1.25)       │   │  │
│  │ │ 10m:  ●───────●─────●────●    (2.28→2.15)       │   │  │
│  │ │ 20m:  ●─────●───────●──────●  (4.02→3.85)       │   │  │
│  │ │                                                  │   │  │
│  │ └──────────────────────────────────────────────────┘   │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ MY GOALS                                                │  │
│  │                                                         │  │
│  │ 🎯 ספרינט 5 מטר: 1.20 שניות                            │  │
│  │    ████████████░░░░ 75%  (נוכחי: 1.25)                 │  │
│  │                                                         │  │
│  │ 🎯 דירוג כללי: 80                                       │  │
│  │    ██████████████░░ 94%  (נוכחי: 75)                   │  │
│  │                                                         │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ AGE GROUP RANKING (U12)                                 │  │
│  │                                                         │  │
│  │ מהירות: 🥇 מקום 3 מתוך 15                               │  │
│  │ קפיצות: 🥈 מקום 5 מתוך 15                               │  │
│  │ כללי:  🏅 מקום 4 מתוך 15 (Top 27%)                     │  │
│  │                                                         │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 5.3 Component Library Extensions

**New Components Needed**:

1. **ProgressStepper** - Horizontal step indicator for assessment flow
2. **TrendChart** - Line chart for metrics over time (using Recharts)
3. **ComparisonCard** - Side-by-side metric comparison
4. **GoalProgress** - Progress bar with target indicator
5. **RankingBadge** - Age group ranking display
6. **StreakCounter** - Animated streak display
7. **AchievementBadge** - Unlocked achievement display
8. **NotificationBell** - Notification dropdown component

---

## 6. Gap Analysis & Priorities

### Priority Matrix

| Feature | Impact | Effort | Priority | Status |
|---------|--------|--------|----------|--------|
| Step-by-step assessments | HIGH | MEDIUM | P1 | ✅ Done |
| Profile completion flow | HIGH | LOW | P1 | ✅ Done |
| Progress charts (trainee) | HIGH | MEDIUM | P1 | 🚧 Next |
| Admin user editing | MEDIUM | LOW | P2 | Pending |
| Form draft saving | MEDIUM | LOW | P2 | Pending |
| Streak tracking | MEDIUM | LOW | P2 | Pending |
| Goals system | MEDIUM | MEDIUM | P2 | Pending |
| Notifications | MEDIUM | MEDIUM | P3 | Pending |
| Achievement badges | LOW | MEDIUM | P3 | Pending |
| Admin analytics | MEDIUM | HIGH | P3 | Pending |
| Age group rankings | LOW | MEDIUM | P4 | Pending |
| Messaging system | LOW | HIGH | P4 | Pending |

### Recommended Implementation Order

**Phase 1: Core Improvements** ✅ IN PROGRESS
1. ✅ Step-by-step assessment entry - COMPLETE
2. ✅ Profile completion during onboarding - COMPLETE
3. 🚧 Basic progress charts on dashboard - NEXT

**Phase 2: Engagement Features**
4. Form draft saving
5. Streak tracking
6. Admin user role editing

**Phase 3: Motivation & Goals**
7. Goals system
8. Achievement badges
9. Assessment comparison view

**Phase 4: Advanced Features**
10. Notifications system
11. Admin analytics dashboard
12. Age group rankings and leaderboards

---

## 7. Implementation Roadmap

### Milestone 1: Assessment System Overhaul ✅ COMPLETE
**Goal**: Transform assessment entry from single form to step-by-step flow

**Tasks**:
- [x] Create SteppedAssessmentForm component → `AssessmentForm.tsx`
- [x] Create AssessmentStepContent component for each category → `AssessmentStepContent.tsx`
- [x] Implement incremental save to database
- [x] Add progress indicator UI → `ProgressStepper.tsx`
- [x] Support skip and resume functionality
- [ ] Show previous values while filling

### Milestone 2: Onboarding & Profile ✅ COMPLETE
**Goal**: Ensure all users have complete profiles

**Tasks**:
- [x] Create profile completion page → `/onboarding/profile`
- [x] Add birthdate field to profiles table (already existed)
- [x] Create onboarding flow redirect → middleware + dashboard layout
- [x] Add profile completeness check to dashboard
- [x] Add position and avatar_url columns
- [x] Create avatars storage bucket with policies
- [x] Create ImageUpload component

### Milestone 3: Progress Visualization
**Goal**: Show trainees their improvement over time

**Tasks**:
- [ ] Create TrendChart component
- [ ] Add progress page to dashboard
- [ ] Calculate deltas between assessments
- [ ] Add mini chart to dashboard home
- [ ] Implement stat-specific detail views

### Milestone 4: Engagement & Gamification
**Goal**: Increase user engagement through streaks and goals

**Tasks**:
- [ ] Create streak tracking logic
- [ ] Add streak display to dashboard
- [ ] Create goals database table
- [ ] Build goals management UI (trainer)
- [ ] Build goals progress UI (trainee)

---

## 8. Design Decisions (Confirmed)

The following decisions have been confirmed:

### Core Decisions (Round 1)

| Question | Decision | Rationale |
|----------|----------|-----------|
| **Assessment Flow** | Minimum required (Date + 1 category) | Flexibility for trainers to complete what's available |
| **Rankings** | Show rankings | Display position in age group - motivating for competitive players |
| **Goals System** | Trainers only | Trainers set goals - ensures realistic targets |
| **Video Tracking** | Just opened (current) | Mark as watched when modal opens - simple approach |
| **Profile Photos** | Yes, add photos | Upload during onboarding - shows on FIFA-style player card |
| **Form Editing** | No editing allowed | Once submitted, cannot be changed (maintain data integrity) |
| **Notifications** | Skip for now | Focus on core features first, add notifications later |
| **Data Export** | Skip for now | Not needed for initial launch |

### Technical Decisions (Round 2)

| Question | Decision | Details |
|----------|----------|---------|
| **Photo Upload Size** | 2MB max | Good balance of quality and performance |
| **Photo Cropping** | Shoulder-and-above cutout | User crops to show shoulders and head (portrait style) |
| **Progress Chart Ranges** | 3m, 6m, 1yr, All | Multiple options for different viewing needs |
| **Streak Counting** | Form OR video | Any form submission or video watched counts toward streak |
| **Step Navigation** | Free navigation | Trainers can go back and edit any step before finishing |
| **Assessment Resume** | Auto-save, resume later | Each step saves to DB, incomplete assessments show "continue" option |
| **Tie Handling** | Same rank | All tied players show same position (e.g., 3 players at #2) |
| **No Assessment State** | Hidden card | Don't show FIFA card until first assessment exists |

### Updated Priority Based on Decisions

**Phase 1: Core (Implement Now)**
1. ✅ Step-by-step assessment (with minimum completion rule) - DONE
2. ✅ Profile completion with photo upload - DONE
3. Progress charts with age group rankings - NEXT

**Phase 2: Enhancement (Next)**
4. Goals system (trainer-managed)
5. Admin user role editing
6. Form draft saving

**Deferred:**
- Notifications system
- Data export
- Form editing capability

---

## 9. Technical Specifications

### 9.1 Database Schema Changes

#### Profile Updates (Migration: 004_profile_enhancements.sql)
```sql
-- Add profile photo and completion fields
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT FALSE;

-- Create storage bucket for profile photos
-- (Done via Supabase dashboard or API)
-- Bucket name: 'avatars'
-- Public: false (use signed URLs)
-- Max file size: 2MB
-- Allowed MIME types: image/jpeg, image/png, image/webp
```

#### Streak Tracking (Migration: 005_user_activity.sql)
```sql
-- Track daily activity for streak calculation
CREATE TABLE user_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  activity_date DATE NOT NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('form_submission', 'video_watched')),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- One activity type per user per day
  UNIQUE(user_id, activity_date, activity_type)
);

CREATE INDEX idx_user_activity_user_date ON user_activity(user_id, activity_date DESC);
```

#### Goals System (Migration: 006_goals.sql)
```sql
-- Player goals set by trainers
CREATE TABLE player_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  metric_name TEXT NOT NULL, -- e.g., 'sprint_5m', 'overall_rating'
  target_value DECIMAL(10,3) NOT NULL,
  current_value DECIMAL(10,3),
  is_lower_better BOOLEAN DEFAULT FALSE, -- true for sprint times
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  achieved_at TIMESTAMPTZ,

  -- One active goal per metric per user
  UNIQUE(user_id, metric_name) WHERE achieved_at IS NULL
);
```

### 9.2 Photo Upload Specifications

| Property | Value |
|----------|-------|
| **Max file size** | 2MB |
| **Accepted formats** | JPEG, PNG, WebP |
| **Storage bucket** | `avatars` |
| **Naming convention** | `{user_id}/{timestamp}.{ext}` |
| **Crop style** | Portrait (shoulders and above) |
| **Resize dimensions** | 400x400 max, maintain aspect ratio |
| **Access** | Signed URLs (private bucket) |

### 9.3 Chart Specifications

| Property | Value |
|----------|-------|
| **Library** | Recharts |
| **Date range options** | 3 months, 6 months, 1 year, All time |
| **Metrics visualized** | All numeric assessment fields |
| **Chart types** | Line chart (trends), Bar chart (comparisons) |
| **Colors** | Green for improvement, Red for regression |

### 9.4 Empty States

| State | Display |
|-------|---------|
| No assessments | Hide FIFA card, show "Awaiting first assessment" message |
| No forms submitted | Show empty state with CTA to complete forms |
| No videos watched | Show video list with progress bar at 0% |
| Incomplete profile | Show banner prompting profile completion |

### 9.5 Step-by-Step Assessment Behavior

| Behavior | Details |
|----------|---------|
| **Minimum to save** | Date + at least 1 category completed |
| **Navigation** | Free - can click any step to edit |
| **Auto-save** | Each step saves to database on "Continue" |
| **Resume** | Incomplete assessments show "Continue Assessment" button |
| **Previous values** | Show last assessment values as reference |
| **Progress indicator** | Horizontal stepper showing completed/current/pending steps |

---

## 10. Implementation Status

### Completed Features ✅

| Feature | Status | Files Created |
|---------|--------|---------------|
| **Player Assessment System** | ✅ Complete | `player_assessments` table, `AssessmentForm.tsx`, `AssessmentStepContent.tsx`, `ProgressStepper.tsx`, rating calculation |
| **Profile Completion Flow** | ✅ Complete | `ProfileCompletionForm.tsx`, `ImageUpload.tsx`, `/onboarding/profile`, middleware redirect, storage bucket |

### In Progress 🚧

| Feature | Status | Notes |
|---------|--------|-------|
| **Progress Charts** | Not started | Next priority - visualize metrics over time |

### Pending Features 📋

- Assessment comparison view
- Goals system (trainer-managed)
- Admin user role editing
- Form draft saving
- Streak tracking
- Achievement badges
- Notifications system

---

*Document Version: 1.3*
*Last Updated: January 2025*
*Status: Phase 1 Items 1 & 2 Complete - Progress Charts Next*
