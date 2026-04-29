# Desktop Sidebar Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-04-29-desktop-sidebar-navigation-design.md`

**Goal:** Replace the desktop top nav on `/admin/*` and `/dashboard/*` with a unified, collapsible, RTL-aware shadcn/ui sidebar that uses Garden of Eden brand colors at WCAG AA-or-better.

**Architecture:** Vendor the official shadcn/ui `sidebar` primitive into `src/components/ui/sidebar.tsx`. Build a shared `AppSidebar` shell (header logo + footer user chip) consumed by surface-specific `AdminSidebar` (5 grouped sections, 11 items) and `DashboardSidebar` (flat 6 items). Override the existing dark `--sidebar-*` tokens with light brand-color values in `globals.css`. Wire each surface's `layout.tsx` with `<SidebarProvider>` + `<SidebarInset>` + a thin `<AppTopBar>` for the toggle, page title, and user menu. Mobile (`<md`) keeps the existing bottom navs untouched.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind 4, Radix UI / shadcn-ui, Vitest, Playwright, `@axe-core/playwright` (new devDep), Supabase (no schema changes).

**Testing strategy (deviation from spec, intentional):** The project rule in `CLAUDE.md` states *"no mock-based tests — the project uses real Supabase data; tests cover pure utility functions only"*. This rule takes precedence over the spec's mention of component-level Vitest tests. Therefore:

- ✅ `wcag.ts` pure utility test (Vitest) — kept.
- ✅ Playwright e2e + a11y (`@axe-core/playwright`) against a real dev server with real auth — kept.
- ❌ Component-level Vitest tests for `AdminSidebar` / `DashboardSidebar` with mocked `user`/`profile` — **dropped**. Behavior is verified end-to-end via Playwright instead.

---

## Task ordering rationale

Tasks are ordered so each one ends with a working, type-checking, lintable, committable repo. The two top-nav components stay alive until their replacements work in `layout.tsx`; only Task 7 / 9 delete them.

| # | Task | Touches | TDD? |
|---|---|---|---|
| 1 | Vendor shadcn sidebar primitive | `src/components/ui/sidebar.tsx` (+ a couple of tiny deps) | n/a (vendored) |
| 2 | Define light brand sidebar tokens | `src/app/globals.css` | n/a (visual) |
| 3 | WCAG contrast utility | `src/lib/utils/wcag.ts` + `wcag.test.ts` | yes |
| 4 | `AppSidebar` shared shell | `src/components/layout/AppSidebar.tsx` | n/a (composition) |
| 5 | `AppTopBar` | `src/components/layout/AppTopBar.tsx` | n/a (composition) |
| 6 | Admin nav data + `AdminSidebar` | `src/components/admin/AdminSidebar.tsx` | n/a |
| 7 | Wire `/admin/layout.tsx`, delete `AdminNav` | `src/app/admin/layout.tsx`, `src/components/admin/AdminNav.tsx` | manual smoke |
| 8 | Trainee nav data + `DashboardSidebar` | `src/components/dashboard/DashboardSidebar.tsx` | n/a |
| 9 | Wire `/dashboard/layout.tsx`, delete `DashboardNav` | `src/app/dashboard/layout.tsx`, `src/components/dashboard/DashboardNav.tsx` | manual smoke |
| 10 | Add `@axe-core/playwright` + a11y e2e | `package.json`, `tests/e2e/sidebar.spec.ts` | yes (Playwright) |
| 11 | Final manual verification + screenshots | none | manual |

---

## Task 1: Vendor the shadcn/ui sidebar primitive

**Files:**
- Create: `src/components/ui/sidebar.tsx`
- Possibly modify: `src/components/ui/sheet.tsx`, `src/components/ui/tooltip.tsx` (only if the CLI updates them)
- Modify: `package.json`, `package-lock.json` (deps the CLI may add)

- [ ] **Step 1: Verify clean working tree**

```bash
git status
```

Expected: clean or only the spec/plan from earlier. Stash anything else first — the CLI may overwrite tracked files and you want a clean diff to review.

- [ ] **Step 2: Run the shadcn CLI to add the sidebar component**

```bash
npx shadcn@latest add sidebar
```

The CLI may prompt for confirmation if `sheet.tsx` or `tooltip.tsx` already exist. Decline the overwrite (press `n`) — those files are already vendored and customized.

Expected: a new file `src/components/ui/sidebar.tsx` is written. The CLI may also install `@radix-ui/react-slot` if missing (already a dep) and add a couple of small CSS variables to `globals.css` — leave any new variables, you will redefine them in Task 2.

- [ ] **Step 3: Verify the imports compile**

```bash
npx tsc --noEmit --pretty false
```

Expected: zero errors related to `sidebar.tsx`. If the CLI added imports from a path alias the project doesn't use, fix the import path to `@/lib/utils` and `@/components/ui/...`.

- [ ] **Step 4: Run lint on the vendored file**

```bash
npx eslint src/components/ui/sidebar.tsx --fix
```

Expected: zero errors. The PostToolUse hook may have already run this.

- [ ] **Step 5: Smoke build**

```bash
npm run build 2>&1 | tail -30
```

Expected: build finishes without errors related to the new file.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/sidebar.tsx package.json package-lock.json
git commit -m "feat(ui): vendor shadcn/ui sidebar primitive"
```

If the CLI inserted or modified anything else (e.g. a tweak in `globals.css`), include it. Inspect the diff before committing.

---

## Task 2: Redefine `--sidebar-*` tokens to light brand colors

**Files:**
- Modify: `src/app/globals.css`

The existing dark sidebar tokens live in the `:root` (light theme) block. The dark theme block (`.dark`) also defines them and stays as-is.

- [ ] **Step 1: Locate the existing sidebar token block**

```bash
grep -n "^\s*--sidebar" src/app/globals.css
```

Expected output (approximate line numbers, two blocks — `:root` first, `.dark` second):

```
49:  --sidebar: oklch(0.12 0.05 145);
50:  --sidebar-foreground: oklch(0.95 0.01 90);
51:  --sidebar-primary: oklch(0.65 0.2 145);
52:  --sidebar-primary-foreground: oklch(0.12 0.05 145);
53:  --sidebar-accent: oklch(0.2 0.05 145);
54:  --sidebar-accent-foreground: oklch(0.95 0.01 90);
55:  --sidebar-border: oklch(0.22 0.04 145);
56:  --sidebar-ring: oklch(0.65 0.2 145);
```

**Only modify the `:root` (light theme) block.** Leave the `.dark` block alone — dark-mode work is out of scope.

- [ ] **Step 2: Replace the light-theme sidebar tokens**

Edit the `:root` block so it reads:

```css
  /* Sidebar: light brand surface (cream) with forest text + accents.
     Dark-mode block below remains unchanged (handled in a future iteration). */
  --sidebar: oklch(99% 0.005 90);
  --sidebar-foreground: oklch(15% 0.04 145);
  --sidebar-primary: oklch(15% 0.04 145);
  --sidebar-primary-foreground: oklch(99% 0.005 90);
  --sidebar-accent: oklch(96% 0.015 145);
  --sidebar-accent-foreground: oklch(15% 0.04 145);
  --sidebar-border: oklch(88% 0.02 145);
  --sidebar-ring: oklch(45% 0.15 145);
```

- [ ] **Step 3: Verify by running the dev server**

```bash
npm run dev
```

Open `http://localhost:3000/admin` (you'll still see the old top nav, since we haven't wired the sidebar yet — the goal here is only that the build still compiles).

Expected: page loads, no console errors. Stop dev server.

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit --pretty false
```

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(theme): redefine light-mode sidebar tokens to brand colors"
```

---

## Task 3: WCAG contrast utility (TDD)

**Files:**
- Create: `src/lib/utils/wcag.ts`
- Create: `src/lib/utils/wcag.test.ts`

We use `src/lib/utils/` (not `src/lib/`) because `vitest.config.ts` only enforces coverage for paths under `src/lib/utils/**`, `src/lib/validations/**`, and `src/features/**/lib/**`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/utils/wcag.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { contrastRatio, meetsAA, meetsAAA, BRAND } from "./wcag";

describe("wcag contrastRatio", () => {
  it("returns 21:1 for black on white", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
  });

  it("returns 1:1 for identical colors", () => {
    expect(contrastRatio("#0A1F0A", "#0A1F0A")).toBeCloseTo(1, 5);
  });

  it("is symmetric", () => {
    const a = contrastRatio("#FFFDF5", "#0A1F0A");
    const b = contrastRatio("#0A1F0A", "#FFFDF5");
    expect(a).toBeCloseTo(b, 5);
  });
});

describe("wcag — sidebar brand pairings (must stay AA or better)", () => {
  it("cream surface + forest text passes AAA (large + body)", () => {
    const r = contrastRatio(BRAND.cream, BRAND.forest);
    expect(meetsAA(r)).toBe(true);
    expect(meetsAAA(r)).toBe(true);
  });

  it("cream surface + earth text passes AAA", () => {
    const r = contrastRatio(BRAND.cream, BRAND.earth);
    expect(meetsAAA(r)).toBe(true);
  });

  it("forest active bg + cream text passes AAA", () => {
    const r = contrastRatio(BRAND.forest, BRAND.cream);
    expect(meetsAAA(r)).toBe(true);
  });

  it("gold badge bg + earth text passes AA (admin badge)", () => {
    const r = contrastRatio(BRAND.gold, BRAND.earth);
    expect(meetsAA(r)).toBe(true);
  });
});

describe("wcag — brand colors that MUST NOT be used as text on cream", () => {
  it("grass on cream fails AA for body text (documents non-text-only constraint)", () => {
    const r = contrastRatio(BRAND.cream, BRAND.grass);
    expect(meetsAA(r)).toBe(false);
  });

  it("gold on cream fails AA for body text (documents non-text-only constraint)", () => {
    const r = contrastRatio(BRAND.cream, BRAND.gold);
    expect(meetsAA(r)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run test:run -- src/lib/utils/wcag.test.ts
```

Expected: FAIL with "Cannot find module './wcag'" (or similar).

- [ ] **Step 3: Write the minimal implementation**

Create `src/lib/utils/wcag.ts`:

```ts
export const BRAND = {
  forest: "#0A1F0A",
  cream: "#FFFDF5",
  earth: "#1C1917",
  gold: "#F59E0B",
  grass: "#22C55E",
} as const;

type Rgb = readonly [number, number, number];

function hexToRgb(hex: string): Rgb {
  const clean = hex.replace("#", "").trim();
  if (clean.length !== 6) {
    throw new Error(`Expected 6-digit hex, got "${hex}"`);
  }
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return [r, g, b];
}

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance([r, g, b]: Rgb): number {
  const [R, G, B] = [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)];
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

export function contrastRatio(hexA: string, hexB: string): number {
  const lA = relativeLuminance(hexToRgb(hexA));
  const lB = relativeLuminance(hexToRgb(hexB));
  const [light, dark] = lA > lB ? [lA, lB] : [lB, lA];
  return (light + 0.05) / (dark + 0.05);
}

export function meetsAA(ratio: number, large = false): boolean {
  return large ? ratio >= 3 : ratio >= 4.5;
}

export function meetsAAA(ratio: number, large = false): boolean {
  return large ? ratio >= 4.5 : ratio >= 7;
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm run test:run -- src/lib/utils/wcag.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Type-check + lint**

```bash
npx tsc --noEmit --pretty false
npx eslint src/lib/utils/wcag.ts src/lib/utils/wcag.test.ts --fix
```

Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/utils/wcag.ts src/lib/utils/wcag.test.ts
git commit -m "feat(utils): WCAG contrast utility with brand color guard tests"
```

---

## Task 4: Build `AppSidebar` shared shell

**Files:**
- Create: `src/components/layout/AppSidebar.tsx`

Reusable shell that knows nothing about admin vs trainee — just composes the shadcn primitives.

- [ ] **Step 1: Create the directory**

```bash
mkdir -p src/components/layout
```

- [ ] **Step 2: Write the component**

Create `src/components/layout/AppSidebar.tsx`:

```tsx
import type { ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import type { Profile } from "@/types/database";

type AppSidebarProps = {
  headerLabel: string;
  headerBadge?: ReactNode;
  user: User;
  profile: Profile | null;
  children: ReactNode;
};

export function AppSidebar({
  headerLabel,
  headerBadge,
  user,
  profile,
  children,
}: AppSidebarProps) {
  const displayName = profile?.full_name ?? user.phone ?? "משתמש";
  const initial = (displayName.trim()[0] ?? "?").toUpperCase();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <span
            aria-hidden="true"
            className="h-6 w-6 rounded-md bg-sidebar-primary"
          />
          <span className="font-black tracking-wide text-sidebar-foreground">
            {headerLabel}
          </span>
          {headerBadge ? <span className="ms-auto">{headerBadge}</span> : null}
        </div>
      </SidebarHeader>

      <SidebarContent>{children}</SidebarContent>

      <SidebarFooter>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <span
            aria-hidden="true"
            className="grid h-8 w-8 place-items-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground text-xs font-semibold"
          >
            {initial}
          </span>
          <span className="truncate text-sm text-sidebar-foreground">
            {displayName}
          </span>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
```

- [ ] **Step 3: Type-check + lint**

```bash
npx tsc --noEmit --pretty false
npx eslint src/components/layout/AppSidebar.tsx --fix
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/AppSidebar.tsx
git commit -m "feat(layout): add AppSidebar shared shell"
```

---

## Task 5: Build `AppTopBar`

**Files:**
- Create: `src/components/layout/AppTopBar.tsx`

The thin top bar inside `<SidebarInset>`. Shows the toggle, the page title, and the user-menu dropdown.

- [ ] **Step 1: Write the component**

Create `src/components/layout/AppTopBar.tsx`:

```tsx
"use client";

import { usePathname, useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { LogOut, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/types/database";

const emptySubscribe = () => () => {};

export type PageTitleResolver = (pathname: string) => string;

type AppTopBarProps = {
  user: User;
  profile: Profile | null;
  resolveTitle: PageTitleResolver;
};

export function AppTopBar({ user, profile, resolveTitle }: AppTopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success("התנתקת בהצלחה");
    router.push("/");
  };

  const title = resolveTitle(pathname);
  const displayName = profile?.full_name ?? user.phone ?? "משתמש";

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-border bg-background px-4">
      <SidebarTrigger />
      <h1 className="text-lg font-semibold text-foreground">{title}</h1>
      <div className="ms-auto">
        {mounted ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2">
                <UserIcon className="h-5 w-5" />
                <span className="hidden sm:inline">{displayName}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="text-muted-foreground">
                {user.phone}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-destructive"
              >
                <LogOut className="ml-2 h-4 w-4" />
                התנתקות
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button variant="ghost" className="gap-2">
            <UserIcon className="h-5 w-5" />
            <span className="hidden sm:inline">{displayName}</span>
          </Button>
        )}
      </div>
    </header>
  );
}

export function makeTitleResolver(
  titles: Record<string, string>,
  fallback: string,
): PageTitleResolver {
  const sortedKeys = Object.keys(titles).sort((a, b) => b.length - a.length);
  return (pathname: string) => {
    for (const key of sortedKeys) {
      if (pathname === key || pathname.startsWith(`${key}/`)) {
        return titles[key];
      }
    }
    return fallback;
  };
}
```

- [ ] **Step 2: Type-check + lint**

```bash
npx tsc --noEmit --pretty false
npx eslint src/components/layout/AppTopBar.tsx --fix
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/AppTopBar.tsx
git commit -m "feat(layout): add AppTopBar with sidebar trigger and user menu"
```

---

## Task 6: Admin nav data + `AdminSidebar`

**Files:**
- Create: `src/components/admin/AdminSidebar.tsx`

This file owns three exports: `NAV_SECTIONS`, `PAGE_TITLES`, and the `AdminSidebar` component. All three live together so the page-title map cannot drift from the nav.

- [ ] **Step 1: Write the component + data**

Create `src/components/admin/AdminSidebar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { AppSidebar } from "@/components/layout/AppSidebar";
import {
  Calendar,
  ClipboardCheck,
  Clock,
  FileText,
  LayoutDashboard,
  RefreshCw,
  Target,
  Users,
  UserPlus,
  Utensils,
  Video,
  type LucideIcon,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/types/database";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
};

type NavSection = {
  label: string;
  items: NavItem[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "ראשי",
    items: [{ href: "/admin", label: "דשבורד", icon: LayoutDashboard }],
  },
  {
    label: "שחקנים",
    items: [
      { href: "/admin/users", label: "משתמשים", icon: Users },
      { href: "/admin/assessments", label: "מבדקים", icon: Target },
      { href: "/admin/nutrition", label: "תזונה", icon: Utensils },
      { href: "/admin/submissions", label: "שאלונים", icon: FileText },
    ],
  },
  {
    label: "משחק ואימון",
    items: [
      { href: "/admin/upcoming-games", label: "משחקים קרובים", icon: Calendar },
      { href: "/admin/videos", label: "סרטונים", icon: Video, adminOnly: true },
    ],
  },
  {
    label: "תפעול",
    items: [
      { href: "/admin/end-of-shift", label: "דוח משמרת", icon: ClipboardCheck },
      { href: "/admin/shifts", label: "שעות עבודה", icon: Clock },
    ],
  },
  {
    label: "שיווק ולקוחות",
    items: [
      { href: "/admin/leads", label: "לידים", icon: UserPlus },
      { href: "/admin/retention", label: "שימור לקוחות", icon: RefreshCw },
    ],
  },
];

export const PAGE_TITLES: Record<string, string> = NAV_SECTIONS.flatMap(
  (s) => s.items,
).reduce<Record<string, string>>((acc, item) => {
  acc[item.href] = item.label;
  return acc;
}, {});

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

type AdminSidebarProps = {
  user: User;
  profile: Profile | null;
};

export function AdminSidebar({ user, profile }: AdminSidebarProps) {
  const pathname = usePathname();
  const isAdmin = profile?.role === "admin";

  return (
    <AppSidebar
      headerLabel="GARDEN OF EDEN"
      headerBadge={
        <Badge
          variant="secondary"
          className="bg-[--color-gold] text-[--color-earth]"
        >
          ניהול
        </Badge>
      }
      user={user}
      profile={profile}
    >
      {NAV_SECTIONS.map((section) => {
        const visibleItems = section.items.filter(
          (item) => !item.adminOnly || isAdmin,
        );
        if (visibleItems.length === 0) return null;
        return (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleItems.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.label}
                      >
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                        >
                          <item.icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        );
      })}
    </AppSidebar>
  );
}
```

- [ ] **Step 2: Type-check + lint**

```bash
npx tsc --noEmit --pretty false
npx eslint src/components/admin/AdminSidebar.tsx --fix
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/AdminSidebar.tsx
git commit -m "feat(admin): add AdminSidebar with 5 grouped sections"
```

---

## Task 7: Wire `/admin/layout.tsx`, delete `AdminNav`

**Files:**
- Modify: `src/app/admin/layout.tsx`
- Delete: `src/components/admin/AdminNav.tsx`

- [ ] **Step 1: Replace the admin layout**

Open `src/app/admin/layout.tsx` and replace the entire file with:

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminSidebar, PAGE_TITLES } from "@/components/admin/AdminSidebar";
import { AdminBottomNav } from "@/components/admin/AdminBottomNav";
import { AppTopBar, makeTitleResolver } from "@/components/layout/AppTopBar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import type { Profile } from "@/types/database";

const resolveTitle = makeTitleResolver(PAGE_TITLES, "ניהול");

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?redirect=/admin");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url, processed_avatar_url, role")
    .eq("id", user.id)
    .single() as unknown as { data: Profile | null };

  if (profile?.role !== "admin" && profile?.role !== "trainer") {
    redirect("/dashboard");
  }

  const cookieStore = await cookies();
  const sidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <AdminSidebar user={user} profile={profile} />
      <SidebarInset>
        <AppTopBar
          user={user}
          profile={profile}
          resolveTitle={resolveTitle}
        />
        <main className="container mx-auto px-4 pt-6 pb-20 md:pb-8">
          {children}
        </main>
        <AdminBottomNav isAdmin={profile?.role === "admin"} />
      </SidebarInset>
    </SidebarProvider>
  );
}
```

Notes:
- `cookies()` is async in Next 15+/16.
- Cookie name `sidebar_state` is what the shadcn primitive writes by default — verify in the next step.
- `<AdminBottomNav>` stays inside `<SidebarInset>` so its `md:hidden` continues to behave correctly.

- [ ] **Step 2: Confirm the cookie key matches the primitive**

```bash
grep -n "sidebar_state\|sidebar:state\|SIDEBAR_COOKIE_NAME" src/components/ui/sidebar.tsx
```

Expected: the constant in the file matches the cookie name used in the layout. If it's a different name (e.g. `sidebar:state`), update the layout to use that exact string.

- [ ] **Step 3: Delete the old `AdminNav`**

```bash
git rm src/components/admin/AdminNav.tsx
```

- [ ] **Step 4: Verify no other file still imports `AdminNav`**

```bash
grep -rn "AdminNav\b" src --include="*.tsx" --include="*.ts"
```

Expected: zero matches (`AdminBottomNav` is fine — different identifier).

- [ ] **Step 5: Type-check + lint + build**

```bash
npx tsc --noEmit --pretty false
npx eslint src/app/admin/layout.tsx --fix
npm run build 2>&1 | tail -20
```

Expected: zero errors. Build completes.

- [ ] **Step 6: Manual smoke test**

```bash
npm run dev
```

Open `http://localhost:3000/admin`. Verify:

1. Sidebar appears on the **right** (RTL).
2. Five section labels render in Hebrew.
3. The current page item is highlighted in dark forest with cream text.
4. Clicking the toggle (☰) collapses the sidebar to icons; reload and the collapsed state persists.
5. Hover an icon while collapsed — tooltip with the Hebrew label appears.
6. Click each nav item — navigation works, active state moves.
7. As `trainer` (not admin), `/admin/videos` does **not** appear.
8. Mobile (resize <768px): sidebar disappears, `AdminBottomNav` is the only nav.

If any of those fail, fix before committing.

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/layout.tsx src/components/admin/AdminNav.tsx
git commit -m "feat(admin): replace top nav with sidebar; delete AdminNav"
```

---

## Task 8: Trainee nav data + `DashboardSidebar`

**Files:**
- Create: `src/components/dashboard/DashboardSidebar.tsx`

- [ ] **Step 1: Write the component + data**

Create `src/components/dashboard/DashboardSidebar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import {
  FileText,
  Home,
  Target,
  Trophy,
  Utensils,
  Video,
  type LucideIcon,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/types/database";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "ראשי", icon: Home },
  { href: "/dashboard/assessments", label: "מבדקים", icon: Target },
  { href: "/dashboard/rankings", label: "דירוג", icon: Trophy },
  { href: "/dashboard/forms", label: "שאלונים", icon: FileText },
  { href: "/dashboard/nutrition", label: "תזונה", icon: Utensils },
  { href: "/dashboard/videos", label: "סרטונים", icon: Video },
];

export const PAGE_TITLES: Record<string, string> = NAV_ITEMS.reduce<
  Record<string, string>
>((acc, item) => {
  acc[item.href] = item.label;
  return acc;
}, {});

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

type DashboardSidebarProps = {
  user: User;
  profile: Profile | null;
};

export function DashboardSidebar({ user, profile }: DashboardSidebarProps) {
  const pathname = usePathname();
  return (
    <AppSidebar
      headerLabel="GARDEN OF EDEN"
      user={user}
      profile={profile}
    >
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={active}
                    tooltip={item.label}
                  >
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </AppSidebar>
  );
}
```

- [ ] **Step 2: Type-check + lint**

```bash
npx tsc --noEmit --pretty false
npx eslint src/components/dashboard/DashboardSidebar.tsx --fix
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/DashboardSidebar.tsx
git commit -m "feat(dashboard): add DashboardSidebar (flat 6-item)"
```

---

## Task 9: Wire `/dashboard/layout.tsx`, delete `DashboardNav`

**Files:**
- Modify: `src/app/dashboard/layout.tsx`
- Delete: `src/components/dashboard/DashboardNav.tsx`

- [ ] **Step 1: Replace the dashboard layout**

Open `src/app/dashboard/layout.tsx` and replace the entire file with:

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { DashboardBottomNav } from "@/components/dashboard/DashboardBottomNav";
import {
  DashboardSidebar,
  PAGE_TITLES,
} from "@/components/dashboard/DashboardSidebar";
import { AppTopBar, makeTitleResolver } from "@/components/layout/AppTopBar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { OnboardingTourProvider } from "@/features/onboarding-tour";
import type { Profile } from "@/types/database";

const resolveTitle = makeTitleResolver(PAGE_TITLES, "ראשי");

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?redirect=/dashboard");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "full_name, avatar_url, processed_avatar_url, profile_completed, role, tour_completed",
    )
    .eq("id", user.id)
    .maybeSingle() as unknown as { data: Profile | null };

  if (
    profile &&
    !profile.profile_completed &&
    profile.role !== "admin" &&
    profile.role !== "trainer"
  ) {
    redirect("/onboarding/profile");
  }

  const cookieStore = await cookies();
  const sidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <DashboardSidebar user={user} profile={profile} />
      <SidebarInset>
        <AppTopBar
          user={user}
          profile={profile}
          resolveTitle={resolveTitle}
        />
        <main className="container mx-auto px-4 pt-6 pb-20 md:pb-8">
          {children}
        </main>
        <DashboardBottomNav />
      </SidebarInset>
      <Suspense fallback={null}>
        <OnboardingTourProvider
          tourCompleted={profile?.tour_completed ?? true}
        />
      </Suspense>
    </SidebarProvider>
  );
}
```

- [ ] **Step 2: Delete the old `DashboardNav`**

```bash
git rm src/components/dashboard/DashboardNav.tsx
```

- [ ] **Step 3: Verify no other file imports `DashboardNav`**

```bash
grep -rn "DashboardNav\b" src --include="*.tsx" --include="*.ts"
```

Expected: zero matches (`DashboardBottomNav` is fine — different identifier).

- [ ] **Step 4: Type-check + lint + build**

```bash
npx tsc --noEmit --pretty false
npx eslint src/app/dashboard/layout.tsx --fix
npm run build 2>&1 | tail -20
```

Expected: zero errors.

- [ ] **Step 5: Manual smoke test**

```bash
npm run dev
```

Open `http://localhost:3000/dashboard` (logged in as a trainee). Verify:
1. Sidebar appears on the **right** with the 6 trainee items.
2. No `ניהול` badge, no section labels.
3. Onboarding tour still triggers if not completed (regression check).
4. Toggle persistence works.
5. Mobile bottom nav still renders below `md`.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/layout.tsx src/components/dashboard/DashboardNav.tsx
git commit -m "feat(dashboard): replace top nav with sidebar; delete DashboardNav"
```

---

## Task 10: Add `@axe-core/playwright` and write the a11y e2e test

**Files:**
- Modify: `package.json`, `package-lock.json`
- Create: `tests/e2e/sidebar.spec.ts`

- [ ] **Step 1: Install the dev dependency**

```bash
npm install --save-dev @axe-core/playwright
```

Expected: dependency added at the latest 4.x version.

- [ ] **Step 2: Write the failing e2e test**

Create `tests/e2e/sidebar.spec.ts`:

```ts
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PAGES_TO_SCAN = ["/admin", "/dashboard"];

test.describe("desktop sidebar — accessibility", () => {
  for (const path of PAGES_TO_SCAN) {
    test(`${path} sidebar (expanded) has no axe color-contrast or aria-required-children violations`, async ({
      page,
    }) => {
      await page.goto(path);
      await expect(page.locator("[data-sidebar='sidebar']")).toBeVisible();

      const expandedResults = await new AxeBuilder({ page })
        .include("[data-sidebar='sidebar']")
        .withRules(["color-contrast", "aria-required-children"])
        .analyze();
      expect(expandedResults.violations).toEqual([]);

      await page.locator("[data-sidebar='trigger']").click();
      // Wait for collapse animation to finish.
      await page.waitForTimeout(400);

      const collapsedResults = await new AxeBuilder({ page })
        .include("[data-sidebar='sidebar']")
        .withRules(["color-contrast", "aria-required-children"])
        .analyze();
      expect(collapsedResults.violations).toEqual([]);

      // Restore expanded state for the next test.
      await page.locator("[data-sidebar='trigger']").click();
    });
  }

  test("/admin sidebar marks the current page item with aria-current='page'", async ({
    page,
  }) => {
    await page.goto("/admin/users");
    const current = page.locator("[aria-current='page']");
    await expect(current).toHaveCount(1);
    await expect(current).toContainText("משתמשים");
  });
});
```

Note: the selectors `[data-sidebar='sidebar']` and `[data-sidebar='trigger']` are the standard data-attributes the shadcn sidebar primitive applies. If the vendored file uses different attribute values, grep for `data-sidebar` in `src/components/ui/sidebar.tsx` and adjust.

- [ ] **Step 3: Run the test**

The auth setup needs `E2E_ADMIN_PHONE` and `E2E_ADMIN_OTP` env vars (see `tests/e2e/auth.setup.ts`).

```bash
E2E_ADMIN_PHONE=... E2E_ADMIN_OTP=... npm run test:e2e -- sidebar.spec.ts
```

Expected: tests run and pass. If any axe violations appear, fix the underlying code (likely a token-contrast slip) and re-run.

- [ ] **Step 4: Type-check + lint**

```bash
npx tsc --noEmit --pretty false
npx eslint tests/e2e/sidebar.spec.ts --fix
```

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tests/e2e/sidebar.spec.ts
git commit -m "test(e2e): sidebar a11y scan + active-state assertion"
```

---

## Task 11: Final manual verification

**Files:** none (manual QA only)

- [ ] **Step 1: Full check on a fresh dev session**

```bash
npm run dev
```

Walk through this checklist with a real test admin and a real test trainee:

| # | Check | Expected |
|---|---|---|
| 1 | `/admin` loads with sidebar on the right | ✓ |
| 2 | Section labels appear in Hebrew, in the spec's order | ✓ |
| 3 | Current page item has dark forest bg + cream text | ✓ |
| 4 | Toggle collapses to icons; reload preserves state | ✓ |
| 5 | Tooltip appears on hover/focus when collapsed | ✓ |
| 6 | `/admin/videos` is hidden for `trainer` role | ✓ |
| 7 | Page title in `AppTopBar` matches the active item | ✓ |
| 8 | `/admin/users/<id>` shows "משתמשים" in the top bar | ✓ |
| 9 | Logout from the top bar dropdown works | ✓ |
| 10 | `/dashboard` loads, no badge, flat list of 6 items | ✓ |
| 11 | Onboarding tour still triggers for incomplete profiles | ✓ |
| 12 | Mobile (<768px) shows bottom nav, no sidebar | ✓ |
| 13 | Cmd/Ctrl+B toggles the sidebar | ✓ |
| 14 | Tab order through nav items is correct | ✓ |
| 15 | `/` (landing page) is unchanged — still uses `Navbar` | ✓ |

- [ ] **Step 2: Visual regression — capture screenshots**

```bash
mkdir -p docs/superpowers/screenshots/2026-04-29-sidebar
# Use Chrome devtools or Playwright to capture:
#   /admin (expanded)
#   /admin (collapsed)
#   /dashboard (expanded)
#   /dashboard (collapsed)
```

Save screenshots to that folder. They are reference for future regressions.

- [ ] **Step 3: Final type-check + build**

```bash
npx tsc --noEmit --pretty false
npm run build 2>&1 | tail -20
```

Expected: zero errors. Build size delta is small (sidebar primitive is tree-shaken; only what's used gets shipped).

- [ ] **Step 4: Commit screenshots if added**

```bash
git add docs/superpowers/screenshots/2026-04-29-sidebar/
git commit -m "docs(sidebar): reference screenshots for desktop sidebar nav"
```

If no screenshots saved, skip this step.

---

## Self-review

I checked the spec against this plan:

- ✅ Goal 1 (replace top nav with sidebar on both surfaces): Tasks 7 and 9.
- ✅ Goal 2 (5 grouped sections for admin): Task 6, `NAV_SECTIONS`.
- ✅ Goal 3 (collapsible, RTL-aware, persistent): Task 1 vendors the primitive; Tasks 7 and 9 read the cookie for SSR-correct `defaultOpen`.
- ✅ Goal 4 (brand colors at WCAG AA+): Task 2 sets tokens; Task 3 unit-tests the pairings; Task 10 axe-scans the rendered sidebar.
- ✅ Goal 5 (top bar with toggle, page title, user menu): Task 5 builds it; Tasks 7 and 9 wire it.
- ✅ Goal 6 (mobile bottom nav unchanged): Tasks 7 and 9 keep `AdminBottomNav` / `DashboardBottomNav`; sidebar is `md+` only via the primitive's breakpoint.
- ✅ Information architecture (admin sections in order, trainee flat list): Task 6 and Task 8 — labels and order match the spec verbatim.
- ✅ File-by-file change list: every "Add", "Modify", "Delete" entry maps to a task. The `package.json` modify entry maps to Task 10.
- ✅ Risks: cookie-based SSR persistence handled (Tasks 7/9 read the cookie); RTL handled by the primitive; tooltips for keyboard users handled by `tooltip` prop on `SidebarMenuButton`; page-title drift mitigated by colocating `PAGE_TITLES` with `NAV_SECTIONS` / `NAV_ITEMS`; brand-color drift trapped by the WCAG unit test.

**Intentional deviation noted:** spec mentioned component-level Vitest tests with mocked `user`/`profile`. Per `CLAUDE.md` rule "no mock-based tests", these are dropped in favor of Playwright e2e + axe a11y, which run against a real Supabase session. This is documented in the plan header so reviewers see it.

**No type/identifier inconsistencies:** `NAV_SECTIONS`, `NAV_ITEMS`, `PAGE_TITLES`, `makeTitleResolver`, `resolveTitle` all match across tasks. `data-sidebar` selectors in Task 10 will be verified against the vendored primitive in Task 1.

**No placeholders:** every task has runnable code, exact paths, and expected output.
