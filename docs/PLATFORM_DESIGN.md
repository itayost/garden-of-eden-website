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
- [x] ~~No trend visualizations (charts/graphs over time)~~ ✅ DONE - Progress charts with date filtering
- [x] ~~No goal setting or target tracking~~ ✅ DONE - Goals system with trainer management
- [x] ~~No comparison to peers (percentile rankings)~~ ✅ DONE - Age group percentile rankings
- [x] ~~No achievement/gamification system~~ ✅ DONE - Achievement badges with 19 badge types

**Communication**
- [ ] No messaging between trainers and trainees
- [ ] No notifications when assessments added
- [ ] No feedback loop on forms

**Admin Tools**
- [x] ~~No user editing (roles, details)~~ ✅ DONE - Admin user editing with activity logs
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
- ~~Forms are tedious, no draft saving~~ ✅ Draft saving implemented

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
- [x] 8 steps: Date → Sprints → Dribbling → Jumps → Agility → Physical → Power → Mental
- [x] Save after each step (persist to database)
- [x] Allow skipping categories
- [x] Show progress indicator (e.g., "Step 3 of 8")
- [ ] Resume incomplete assessments (partial - form saves on submit)
- [ ] Show previous values for comparison while filling

#### FR-ASS-002: Assessment Comparison View ✅ DONE
**Description**: Show changes between assessments
**Requirements**:
- [x] Side-by-side comparison of 2 assessments
- [x] Highlight improvements (green) and regressions (red)
- [x] Calculate deltas (e.g., "-0.15s in 5m sprint")

#### FR-ASS-003: Progress Charts ✅ DONE
**Description**: Visualize metrics over time
**Requirements**:
- [x] Line charts for numeric metrics (sprints, jumps)
- [x] Rating trend charts with all 6 stats
- [x] Date range filter (1m, 3m, 6m, 1y, all)
- [x] Age group percentile rankings (top 3 displayed)
- [x] Physical metrics organized by category (sprint, dribbling, jump, agility, flexibility, power)
- [ ] Export chart as image (deferred)

### 4.2 User Management (Priority: HIGH)

#### FR-USR-001: Profile Completion ✅ DONE
**Description**: Collect required user information
**Requirements**:
- [x] Onboarding flow after first login
- [x] Required fields: full name, birthdate
- [x] Optional fields: position, profile photo
- [x] Prompt to complete if profile incomplete (middleware + layout redirect)

#### FR-USR-002: Admin User Editing ✅ DONE
**Description**: Allow admins to manage users
**Requirements**:
- [x] Edit user details (name, phone, birthdate)
- [x] Change user roles (trainee ↔ trainer ↔ admin)
- [x] Deactivate/reactivate users (is_active flag with soft delete)
- [x] View user activity history (activity_logs table with full audit trail)
- [x] Database-level protection against self-modification of role/status

### 4.3 Forms System (Priority: MEDIUM)

#### FR-FRM-001: Draft Saving ✅ DONE
**Description**: Auto-save form progress
**Requirements**:
- [x] Save to localStorage every 10 seconds
- [x] Restore draft on page load
- [x] Clear draft after successful submission
- [x] Warning if navigating away with unsaved changes

#### FR-FRM-002: Form Edit Capability
**Description**: Allow editing submitted forms (within time limit)
**Requirements**:
- [ ] Edit button on recent submissions (last 24 hours)
- [ ] Audit log of changes
- [ ] Trainer can request re-submission

### 4.4 Progress & Gamification (Priority: MEDIUM)

#### FR-PRG-001: Streak Tracking ✅ DONE
**Description**: Track consecutive training days
**Requirements**:
- [x] Count consecutive weekdays with form submissions or video watches
- [x] Display streak on dashboard (StreakCard component)
- [x] Toast notification for milestones (7, 30, 100 days)
- [x] Weekend exempt (weekdays only Mon-Fri, weekends don't break streak)
- [x] Database triggers for automatic tracking

#### FR-PRG-002: Achievement Badges ✅ DONE
**Description**: Reward accomplishments
**Requirements**:
- [x] Badge for completing nutrition form
- [x] Badge for watching all videos
- [x] Badge for first assessment
- [x] Badge for improvement milestones
- [x] Additional badges: profile completion, forms, streaks, goals

#### FR-PRG-003: Goals System ✅ DONE
**Description**: Set and track personal goals
**Requirements**:
- [x] Trainer can set goals per player (GoalManagementPanel)
- [x] Player can see their goals (GoalsList on dashboard)
- [x] Progress bar toward each goal (GoalCard with progress)
- [x] Notification when goal achieved (toast celebration)

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

#### FR-ANL-002: Age Group Comparisons ✅ DONE
**Description**: Compare players within age groups
**Requirements**:
- [x] Leaderboard by metric (sprint, jump, etc.)
- [x] Percentile rankings
- [x] Group averages and distribution

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
| Progress charts (trainee) | HIGH | MEDIUM | P1 | ✅ Done |
| Admin user editing | MEDIUM | LOW | P2 | ✅ Done |
| Form draft saving | MEDIUM | LOW | P2 | ✅ Done |
| Streak tracking | MEDIUM | LOW | P2 | ✅ Deployed |
| Goals system | MEDIUM | MEDIUM | P2 | ✅ Deployed |
| Achievement badges | LOW | MEDIUM | P3 | ✅ Done |
| Notifications | MEDIUM | MEDIUM | P3 | Pending |
| Admin analytics | MEDIUM | HIGH | P3 | Pending |
| Age group rankings | LOW | MEDIUM | P4 | ✅ Done |
| Messaging system | LOW | HIGH | P4 | Pending |

### Recommended Implementation Order

**Phase 1: Core Improvements** ✅ COMPLETE
1. ✅ Step-by-step assessment entry - COMPLETE
2. ✅ Profile completion during onboarding - COMPLETE
3. ✅ Progress charts with age group rankings - COMPLETE
4. ✅ Admin user editing with activity logs - COMPLETE

**Phase 2: Engagement Features** ✅ DEPLOYED
5. ✅ Form draft saving - DEPLOYED
6. ✅ Streak tracking - DEPLOYED (migration applied)
7. ✅ Goals system (trainer-managed) - DEPLOYED (migration applied)

**Phase 3: Motivation & Goals** ✅ COMPLETE
8. ✅ Achievement badges - DONE
9. ✅ Assessment comparison view - DONE

**Phase 4: Advanced Features** (Partial)
10. Notifications system
11. Admin analytics dashboard
12. ✅ Age group rankings and leaderboards - DONE

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

### Milestone 3: Progress Visualization ✅ COMPLETE
**Goal**: Show trainees their improvement over time

**Tasks**:
- [x] Create TrendChart component → `RatingTrendChart.tsx`, `PhysicalMetricChart.tsx`
- [x] Add progress view to dashboard → `/dashboard/assessments` with charts tab
- [x] Calculate deltas between assessments → `transforms/index.ts`
- [x] Implement stat-specific detail views → Tabbed physical metrics by category
- [x] Add date range filtering → `DateRangeFilter.tsx`, `useDateRangeFilter.ts`
- [x] Add age group percentile rankings → `PercentileCard.tsx`
- [x] Feature module architecture → `/src/features/progress-charts/`

### Milestone 4: Admin User Editing ✅ COMPLETE
**Goal**: Enable admins to manage users, roles, and track activity

**Tasks**:
- [x] Add `is_active` column to profiles for soft delete
- [x] Create `activity_logs` table with RLS policies
- [x] Create user edit form with validation (`UserEditForm.tsx`)
- [x] Create activity log components (`ActivityLogRow.tsx`, `ActivityLogTable.tsx`)
- [x] Create user edit page (`/admin/users/[userId]`)
- [x] Add edit links to users list
- [x] Add database-level protection against self-modification of role/status
- [x] Add error handling and proper type safety

### Milestone 5: Engagement & Gamification ✅ DEPLOYED
**Goal**: Increase user engagement through streaks and goals

**Tasks**:
- [x] Create streak tracking logic → `006_streak_tracking.sql` (triggers, functions) ✅ Deployed
- [x] Add streak display to dashboard → `StreakCard.tsx`, `StreakCelebrationClient.tsx`
- [x] Feature module architecture → `/src/features/streak-tracking/`
- [x] Create goals database table → `007_goals_system.sql` (with triggers for auto-achievement) ✅ Deployed
- [x] Build goals management UI (trainer) → `GoalManagementPanel.tsx`, `SetGoalDialog.tsx`
- [x] Build goals progress UI (trainee) → `GoalsList.tsx`, `GoalCard.tsx`, `GoalCelebrationClient.tsx`
- [x] Feature module architecture → `/src/features/goals/`

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

**Phase 1: Core** ✅ COMPLETE
1. ✅ Step-by-step assessment (with minimum completion rule) - DONE
2. ✅ Profile completion with photo upload - DONE
3. ✅ Progress charts with age group rankings - DONE

**Phase 2: Enhancement (In Progress)**
4. Admin user role editing - NEXT
5. Goals system (trainer-managed)
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

#### Streak Tracking (Migration: 006_streak_tracking.sql) ✅ IMPLEMENTED
```sql
-- User streaks table with automatic trigger updates
CREATE TABLE user_streaks (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  current_streak INTEGER DEFAULT 0 NOT NULL,
  longest_streak INTEGER DEFAULT 0 NOT NULL,
  last_activity_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Helper functions: is_weekday_israel(), count_weekdays_missed()
-- Core function: update_user_streak() with FOR UPDATE locking
-- Triggers on: pre_workout_forms, post_workout_forms, nutrition_forms, video_progress
-- RLS policies for user/admin access
```

#### Goals System (Migration: 007_goals.sql)
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
| **Progress Charts with Age Group Rankings** | ✅ Complete | Feature module at `/src/features/progress-charts/` with components: `RatingTrendChart.tsx`, `PhysicalMetricChart.tsx`, `PercentileCard.tsx`, `DateRangeFilter.tsx`; hooks: `useDateRangeFilter.ts`; transforms and utilities |
| **Admin User Editing** | ✅ Complete | Migration `005_user_editing_and_activity_logs.sql` (is_active + activity_logs), `UserEditForm.tsx`, `ActivityLogRow.tsx`, `ActivityLogTable.tsx`, `/admin/users/[userId]` edit page, user list with edit links and status badges |
| **Form Draft Saving** | ✅ Complete | Feature module at `/src/features/form-drafts/` with `useFormDraft` hook, localStorage storage utilities, auto-save every 10s, draft restoration with toast notification, beforeunload warning |
| **Streak Tracking** | ✅ Deployed | Feature module at `/src/features/streak-tracking/` with database triggers (`006_streak_tracking.sql` - deployed), `StreakCard.tsx`, `StreakCelebrationClient.tsx`, `useStreakCelebration` hook; weekday-only tracking (Mon-Fri), toast celebrations at milestones (7, 30, 100 days) |
| **Goals System** | ✅ Deployed | Feature module at `/src/features/goals/` with database triggers (`007_goals_system.sql` - deployed), components: `GoalCard.tsx`, `GoalsList.tsx`, `GoalManagementPanel.tsx`, `SetGoalDialog.tsx`, `GoalCelebrationClient.tsx`; hooks: `useGoalCelebration.ts`; auto-achievement detection via DB triggers; trainer UI on `/admin/assessments/[userId]`, trainee display on dashboard |
| **Achievement Badges** | ✅ Done | Feature module at `/src/features/achievements/` with database triggers (`008_achievement_badges.sql`), components: `AchievementBadge.tsx`, `AchievementsList.tsx`, `AchievementsCard.tsx`, `AchievementCelebrationClient.tsx`; hooks: `useAchievementCelebration.tsx`; 19 badge types across 6 categories (onboarding, videos, assessments, improvements, streaks, goals); automatic unlocking via DB triggers; rarity system with points; dashboard integration |
| **Assessment Comparison View** | ✅ Done | Feature module at `/src/features/assessment-comparison/` with components: `AssessmentComparison.tsx`, `ComparisonSelector.tsx`; utility functions: `comparison-utils.ts` (calculateDelta, isImprovement, formatDelta, compareAssessments); side-by-side comparison of 2 assessments; improvements highlighted in green, regressions in red; delta calculation with proper units; summary counts for improvements/regressions/unchanged; integrated as third tab in `/dashboard/assessments`; 26 unit tests with Vitest |
| **Age Group Rankings** | ✅ Done | Feature module at `/src/features/rankings/` with components: `RankingsView.tsx`, `CategoryLeaderCards.tsx`, `LeaderboardTable.tsx`, `GroupStatisticsCard.tsx`, `DistributionChart.tsx`, `AgeGroupFilter.tsx`; utility functions: `ranking-utils.ts` (getLatestAssessmentPerUser, calculateRankings, calculateGroupStatistics, createDistributionBins); server action: `get-rankings.ts`; 5 category leaders (Sprint, Jump, Agility, Flexibility, Power); full leaderboard with percentile rankings; group statistics with distribution histogram; age group filtering; dedicated page at `/dashboard/rankings`; 21 unit tests with Vitest (47 total across features) |

### Pending Features 📋

- Notifications system
- Admin analytics dashboard

---

*Document Version: 2.2*
*Last Updated: January 2026*
*Status: Phase 4 Partial - Age Group Rankings complete, Notifications and Admin Analytics pending*
