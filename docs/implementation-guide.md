Garden of Eden Website - Implementation Plan
Project Overview
A Next.js 14 website for a soccer training facility with:
Landing Page - Hebrew RTL, conversion-focused, inspired by gardengym.co.il
Member Portal - Phone+SMS OTP auth, forms, workout videos
Admin Panel - Full dashboard for trainers
Technology Stack
Framework: Next.js 14 (App Router)
Styling: Tailwind CSS + shadcn/ui components
Database/Auth: Supabase (PostgreSQL + phone OTP)
Language: TypeScript
RTL Support: Built-in with Tailwind + next-intl (Hebrew)
Videos: YouTube embeds (placeholders initially)
Phase 1: Project Setup
1.1 Initialize Next.js Project

npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir
1.2 Install Dependencies
@supabase/supabase-js + @supabase/ssr - Auth & DB
shadcn/ui - UI components
react-hook-form + zod - Form handling
lucide-react - Icons
framer-motion - Animations
1.3 Configure
Tailwind RTL support
Hebrew fonts (Heebo/Assistant)
Supabase client setup
Environment variables
Phase 2: Database Schema (Supabase)
Tables:

-- Users (extends Supabase auth.users)
profiles:
  - id (uuid, FK to auth.users)
  - full_name (text)
  - phone (text)
  - role (enum: 'trainee', 'trainer', 'admin')
  - created_at (timestamp)

-- Trainers
trainers:
  - id (uuid)
  - name (text)
  - active (boolean)

-- Pre-workout submissions
pre_workout_forms:
  - id (uuid)
  - user_id (FK)
  - age (int)
  - group_training (text)
  - urine_color (text)
  - nutrition_status (text)
  - last_game (text)
  - improvements_desired (text)
  - sleep_hours (text)
  - recent_injury (text)
  - next_match (text)
  - submitted_at (timestamp)

-- Post-workout submissions
post_workout_forms:
  - id (uuid)
  - user_id (FK)
  - training_date (date)
  - trainer_id (FK)
  - difficulty_level (int 1-10)
  - satisfaction_level (int 1-10)
  - comments (text)
  - submitted_at (timestamp)

-- Nutrition questionnaire (one-time)
nutrition_forms:
  - id (uuid)
  - user_id (FK)
  - full_name (text)
  - age (int)
  - years_competitive (text)
  - previous_counseling (boolean)
  - counseling_details (text)
  - weight (decimal)
  - height (decimal)
  - allergies (boolean)
  - allergies_details (text)
  - chronic_conditions (boolean)
  - conditions_details (text)
  - medications (text)
  - medications_list (text)
  - bloating_frequency (int)
  - stomach_pain (int)
  - bowel_frequency (int)
  - stool_consistency (text)
  - overuse_injuries (text)
  - illness_interruptions (int)
  - max_days_missed (int)
  - fatigue_level (int)
  - concentration (int)
  - energy_level (int)
  - muscle_soreness (int)
  - physical_exhaustion (int)
  - preparedness (int)
  - overall_energy (int)
  - additional_comments (text)
  - submitted_at (timestamp)

-- Workout videos
workout_videos:
  - id (uuid)
  - day_number (int 1-5)
  - day_topic (text)
  - title (text)
  - youtube_url (text)
  - duration_minutes (int)
  - order_index (int)
Phase 3: Landing Page
Sections:
Hero Section
Full-width background (soccer field/training)
Main headline + subheadline
CTA buttons: WhatsApp + Phone
Animated elements
About Section
Brief about Garden of Eden
Key differentiators
Services/Programs Section
Training packages with pricing
Feature comparison cards
Training Philosophy
4 pillars (like reference): Lifestyle, Athletic capability, Mental resilience, Technical analysis
Icon cards with descriptions
Video Preview Section
Embedded intro video
Training highlights
Testimonials
Carousel of reviews
Player photos + quotes
Contact Section
WhatsApp button
Phone call button
Location map (optional)
Footer
Links, social media, copyright
Files to Create:
src/app/page.tsx - Landing page
src/components/landing/Hero.tsx
src/components/landing/About.tsx
src/components/landing/Services.tsx
src/components/landing/Philosophy.tsx
src/components/landing/Testimonials.tsx
src/components/landing/Contact.tsx
src/components/landing/Footer.tsx
Phase 4: Authentication System
4.1 Phone + SMS OTP Flow
User enters phone number
Supabase sends OTP via SMS
User enters OTP code
Session created, profile auto-created
4.2 Files:
src/app/auth/login/page.tsx - Phone input
src/app/auth/verify/page.tsx - OTP verification
src/lib/supabase/client.ts - Browser client
src/lib/supabase/server.ts - Server client
src/middleware.ts - Protected routes
4.3 Supabase SMS Setup
Configure Twilio/MessageBird in Supabase dashboard
Set up phone auth provider
Phase 5: Member Portal
5.1 Dashboard (/dashboard)
Welcome message
Quick actions: Fill forms, Watch videos
Recent submissions history
Progress indicators
5.2 Forms Section (/dashboard/forms)
Pre-workout form (/dashboard/forms/pre-workout)
Post-workout form (/dashboard/forms/post-workout)
Nutrition form (/dashboard/forms/nutrition) - Shows only if not completed
5.3 Videos Section (/dashboard/videos)
5 day tabs
Video cards for each day
Duration and set info
Progress tracking (watched/not watched)
Files:
src/app/dashboard/page.tsx
src/app/dashboard/layout.tsx
src/app/dashboard/forms/page.tsx
src/app/dashboard/forms/pre-workout/page.tsx
src/app/dashboard/forms/post-workout/page.tsx
src/app/dashboard/forms/nutrition/page.tsx
src/app/dashboard/videos/page.tsx
src/components/forms/PreWorkoutForm.tsx
src/components/forms/PostWorkoutForm.tsx
src/components/forms/NutritionForm.tsx
src/components/videos/VideoCard.tsx
src/components/videos/DayTabs.tsx
Phase 6: Admin Panel
6.1 Admin Dashboard (/admin)
Total users count
Forms submitted today/week
Recent activity feed
6.2 Users Management (/admin/users)
List all trainees
View individual profiles
See submission history
6.3 Form Submissions (/admin/submissions)
Filter by form type
Filter by date range
Export to CSV
View individual submissions
6.4 Analytics (/admin/analytics)
Charts: submissions over time
Average satisfaction scores
Trainer performance
6.5 Videos Management (/admin/videos)
Add/edit/delete videos
Organize by day
Files:
src/app/admin/page.tsx
src/app/admin/layout.tsx
src/app/admin/users/page.tsx
src/app/admin/submissions/page.tsx
src/app/admin/analytics/page.tsx
src/app/admin/videos/page.tsx
src/components/admin/StatsCard.tsx
src/components/admin/DataTable.tsx
src/components/admin/SubmissionView.tsx
Phase 7: Polish & Deploy
7.1 Optimization
Image optimization
Lazy loading
SEO meta tags
Open Graph images
7.2 Mobile Responsiveness
Test all breakpoints
Touch-friendly interactions
7.3 Deployment
Vercel deployment
Environment variables setup
Supabase production settings
File Structure Summary

src/
├── app/
│   ├── page.tsx                    # Landing page
│   ├── layout.tsx                  # Root layout (RTL, fonts)
│   ├── globals.css
│   ├── auth/
│   │   ├── login/page.tsx
│   │   └── verify/page.tsx
│   ├── dashboard/
│   │   ├── page.tsx
│   │   ├── layout.tsx
│   │   ├── forms/
│   │   │   ├── page.tsx
│   │   │   ├── pre-workout/page.tsx
│   │   │   ├── post-workout/page.tsx
│   │   │   └── nutrition/page.tsx
│   │   └── videos/page.tsx
│   └── admin/
│       ├── page.tsx
│       ├── layout.tsx
│       ├── users/page.tsx
│       ├── submissions/page.tsx
│       ├── analytics/page.tsx
│       └── videos/page.tsx
├── components/
│   ├── ui/                         # shadcn components
│   ├── landing/                    # Landing page sections
│   ├── forms/                      # Form components
│   ├── videos/                     # Video components
│   └── admin/                      # Admin components
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── middleware.ts
│   ├── validations/                # Zod schemas
│   └── utils.ts
└── types/
    └── database.ts                 # Supabase types
Implementation Order
Project setup & configuration - Next.js, Tailwind, Supabase
Database schema - Create tables in Supabase
Landing page - All sections with Hebrew content
Auth system - Phone OTP login/signup
Member portal - Dashboard, forms, videos
Admin panel - Full management dashboard
Testing & polish - Responsive, SEO, performance
Deployment - Vercel + production config