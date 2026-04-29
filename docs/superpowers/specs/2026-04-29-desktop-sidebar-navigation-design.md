# Desktop Sidebar Navigation Design

**Status:** Draft for review
**Date:** 2026-04-29
**Scope:** Desktop chrome for `/admin/*` and `/dashboard/*`. Mobile is explicitly out of scope.
**Optimizing for:** Reducing visual cramming in the admin top nav (11 items), introducing grouped information architecture, and unifying the desktop chrome under a single shadcn/ui sidebar primitive — using Garden of Eden brand colors at WCAG AA or better.

## Context

Two surfaces use a sticky horizontal top nav today:

- `src/components/admin/AdminNav.tsx` — 11 nav items rendered inline (`navItems` at lines 35–47). At common viewport widths the bar fills end-to-end and there is no room for new items. One item is admin-only (`סרטונים`); trainers see ten.
- `src/components/dashboard/DashboardNav.tsx` — six nav items for trainees, comfortable at desktop widths but visually inconsistent with the admin surface.

Both layouts (`src/app/admin/layout.tsx`, `src/app/dashboard/layout.tsx`) wrap the nav in a `container mx-auto px-4` shell with a sticky header and a separate mobile bottom nav (`AdminBottomNav`, `DashboardBottomNav`). Mobile UX is a known unfinished area; that work is **not** in this spec.

The codebase already vendors several shadcn/ui primitives (`sheet.tsx`, `tooltip.tsx`, `skeleton.tsx`) but does **not** yet vendor the official `sidebar` primitive. Brand color tokens are defined in `src/app/globals.css`: `--color-forest #0A1F0A`, `--color-cream #FFFDF5`, `--color-grass #22C55E`, `--color-gold #F59E0B`, `--color-earth #1C1917`. The current `--sidebar` token is dark (`oklch(0.12 0.05 145)`) — `AdminNav` uses it, `DashboardNav` does not. The visual language is therefore inconsistent today.

## Goals

1. Replace the desktop top nav with a left-edge sidebar (right-edge in RTL, which is the default `dir`) on **both** `/admin/*` and `/dashboard/*`.
2. Introduce grouped information architecture for `/admin/*` so 11 items become five labelled sections.
3. Use the official shadcn/ui `sidebar` primitive — collapsible to icons, RTL-aware, persistent expand/collapse state.
4. Use Garden of Eden brand colors (forest, cream, grass, gold, earth) on the sidebar surface and verify every text/UI pairing hits WCAG 2.1 AA (4.5:1 text, 3:1 non-text).
5. Add a thin top bar containing the sidebar toggle, the page title, and the user menu.
6. Keep mobile bottom navs (`AdminBottomNav`, `DashboardBottomNav`) untouched. The sidebar is desktop-only (`md+`).

## Non-goals

- Mobile navigation redesign (no hamburger drawer, no bottom-nav reorganization). The existing mobile bottom navs render as-is below `md`.
- Touching the public landing nav (`src/components/landing/Navbar.tsx`).
- Routing/IA changes beyond visual grouping. URLs and page-level layouts stay identical.
- Theme dark-mode work. Brand-color light surface is the only theme this spec covers.
- Adding new pages or new nav items. Same eleven admin items, same six trainee items.

## Decisions (converged in brainstorm)

| Decision | Choice |
|---|---|
| Scope | Both admin and trainee surfaces |
| Admin grouping | 5 sections with Hebrew section labels |
| Trainee grouping | None — flat list of 6 items |
| Sidebar behavior | Collapsible to icons; user-toggled; preference persists |
| Top chrome | Sidebar + thin top bar with toggle, page title, user menu |
| Visual direction | Unified light brand-color theme on both surfaces |
| Mobile | Unchanged — handled later |
| Implementation | Vendor shadcn/ui `sidebar` primitive |

## Information architecture — `/admin/*`

Admin sidebar groups the existing 11 items (matching `AdminNav.tsx:35-47`) into five sections. Order, labels, and items are exact:

1. **ראשי**
   - דשבורד (`/admin`)
2. **שחקנים**
   - משתמשים (`/admin/users`)
   - מבדקים (`/admin/assessments`)
   - תזונה (`/admin/nutrition`)
   - שאלונים (`/admin/submissions`)
3. **משחק ואימון**
   - משחקים קרובים (`/admin/upcoming-games`)
   - סרטונים (`/admin/videos`) — admin-only, hidden for `trainer` role
4. **תפעול**
   - דוח משמרת (`/admin/end-of-shift`)
   - שעות עבודה (`/admin/shifts`)
5. **שיווק ולקוחות**
   - לידים (`/admin/leads`)
   - שימור לקוחות (`/admin/retention`)

Section headings render as small uppercase muted text. When the sidebar collapses to icons-only, headings are hidden and items become a single list of icons separated by a thin divider per section.

## Information architecture — `/dashboard/*`

Trainee sidebar is a flat list of six items in this order (matches `DashboardNav.tsx:30-38`):

- ראשי (`/dashboard`)
- מבדקים (`/dashboard/assessments`)
- דירוג (`/dashboard/rankings`)
- שאלונים (`/dashboard/forms`)
- תזונה (`/dashboard/nutrition`)
- סרטונים (`/dashboard/videos`)

No section headings. Same icons as today.

## Architecture

### File layout

```
src/components/ui/sidebar.tsx           ← shadcn/ui sidebar primitive (vendored via CLI)
src/components/layout/AppSidebar.tsx    ← shared shell: header (logo), footer (user menu)
src/components/layout/AppTopBar.tsx     ← thin top bar: SidebarTrigger + page title slot + user menu fallback
src/components/admin/AdminSidebar.tsx   ← admin nav data + sections (consumes AppSidebar)
src/components/dashboard/DashboardSidebar.tsx ← trainee nav data (consumes AppSidebar)

src/app/admin/layout.tsx       ← <SidebarProvider><AdminSidebar/><SidebarInset><AppTopBar/>{children}</SidebarInset></SidebarProvider>
src/app/dashboard/layout.tsx   ← <SidebarProvider><DashboardSidebar/><SidebarInset><AppTopBar/>{children}</SidebarInset></SidebarProvider>
```

### Component contracts

- **`AppSidebar`** is the shared shell. It composes `<Sidebar>`, `<SidebarHeader>`, `<SidebarContent>`, `<SidebarFooter>` from the primitive and does not know about admin vs trainee. Props: `headerLabel: string` (rendered inside `<SidebarHeader>` next to the logo mark), `headerBadge?: ReactNode` (optional badge slot, e.g. the gold "ניהול" badge), `user: User`, `profile: Profile | null` (used by the `<SidebarFooter>` to render the avatar + name chip), `children: ReactNode` (rendered inside `<SidebarContent>` — this is where consumers pass their nav groups).
- **`AdminSidebar`** declares the five-section structure as data and renders `<SidebarGroup>` / `<SidebarGroupLabel>` / `<SidebarMenu>` / `<SidebarMenuItem>` per item. Filters out `adminOnly: true` items when `profile.role !== "admin"`. Passes `headerBadge=<Badge>ניהול</Badge>` to `AppSidebar`.
- **`DashboardSidebar`** declares the flat list and renders one `<SidebarMenu>`. No badge.
- **`AppTopBar`** renders the `<SidebarTrigger>` (toggle button), the current page title, and the user-menu dropdown. Page title resolves by walking `PAGE_TITLES` keys longest-prefix-first against the current pathname, so `/admin/users/abc-123` resolves to the title for `/admin/users`. Falls back to the surface root title (`/admin` → "ניהול", `/dashboard` → "ראשי") if no prefix matches. The map is colocated with the nav item arrays so they stay in sync.
- **Existing `AdminNav` and `DashboardNav` are deleted.**

### Data shape

```ts
type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
};

type NavSection = {
  label: string;       // empty string for ungrouped (trainee)
  items: NavItem[];
};
```

The admin file exports `NAV_SECTIONS: NavSection[]`; the dashboard file exports `NAV_ITEMS: NavItem[]`. Both also export a `PAGE_TITLES: Record<string, string>` consumed by `AppTopBar`.

### Layout chrome

- `<SidebarProvider>` owns the open/collapsed state. The shadcn primitive persists this in a cookie (`sidebar:state=expanded|collapsed`) so the server-rendered first paint has the correct width. Per project rule "do not edit `.env.local`", we are using the standard cookie-based persistence — no env vars.
- `<SidebarInset>` is the content column. It auto-adjusts margin when the sidebar collapses.
- `AppTopBar` is sticky at the top of the inset with `h-14` and a 1px bottom border. Contents from start to end (RTL): `<SidebarTrigger>` (hamburger), page title (`<h1>` styled as `text-lg font-semibold`), spacer, user-menu dropdown.
- The top bar is the only place the user menu lives on desktop. The sidebar footer also shows the avatar + name (so identity is always visible), but the dropdown trigger lives in the top bar where users expect it.

### RTL behavior

The shadcn `sidebar` primitive respects the `dir` attribute on `<html>` (already `dir="rtl"` per the project). With `dir="rtl"`:
- Sidebar is on the **right** edge.
- Collapse animation slides it toward the right (off-screen direction); the inset reclaims space on the left.
- All `border-inline-start` / `border-inline-end` / `start` / `end` logical properties resolve correctly.

The mobile sheet (which we are not using on `md+` and not changing on `<md`) would slide from the right; this is irrelevant to this spec but documented for future mobile work.

### Keyboard and a11y

- Sidebar toggle is a `<button>` with `aria-controls`, `aria-expanded`, and the keyboard shortcut already provided by shadcn (`Ctrl/Cmd+B`).
- Each `SidebarMenuItem` is an `<a>` (Next.js `Link`) — full tab order.
- The current page item carries `aria-current="page"`.
- Section labels are `<h2>` styled as small uppercase, programmatically associated with their `<ul>` via `aria-labelledby`.
- Collapsed (icons-only) state shows `Tooltip`s on hover/focus with the item label, so the label stays discoverable to keyboard and screen-reader users.

## Theme & WCAG

### Token redefinition

Override the existing dark `--sidebar-*` tokens in `src/app/globals.css` with light brand-color values. Only the sidebar tokens change; `--background`, `--foreground`, `--primary` etc. are untouched.

| Token | New value | Purpose |
|---|---|---|
| `--sidebar` | `oklch(99% 0.005 90)` (≈ `#FFFDF5` cream) | Sidebar surface |
| `--sidebar-foreground` | `oklch(15% 0.04 145)` (≈ `#0A1F0A` forest) | Item label text |
| `--sidebar-primary` | `oklch(15% 0.04 145)` (forest) | Active item background |
| `--sidebar-primary-foreground` | `oklch(99% 0.005 90)` (cream) | Active item text |
| `--sidebar-accent` | `oklch(96% 0.015 145)` | Hover background |
| `--sidebar-accent-foreground` | `oklch(15% 0.04 145)` (forest) | Hover text |
| `--sidebar-border` | `oklch(88% 0.02 145)` | Divider lines |
| `--sidebar-ring` | `oklch(45% 0.15 145)` (existing primary) | Focus ring |

The badge (`ניהול`) on the admin sidebar header uses `--gold #F59E0B` background with `--earth #1C1917` text.

### WCAG contrast table (verified, AA minimum / AAA where noted)

| Pairing | Hex | Ratio | Required | Pass |
|---|---|---|---|---|
| Sidebar surface + item label | `#FFFDF5` / `#0A1F0A` | 18.9:1 | 4.5:1 | AAA ✓ |
| Sidebar surface + secondary text (earth) | `#FFFDF5` / `#1C1917` | 17.2:1 | 4.5:1 | AAA ✓ |
| Active item bg + active text | `#0A1F0A` / `#FFFDF5` | 18.9:1 | 4.5:1 | AAA ✓ |
| Sidebar surface + section label (muted-foreground) | `#FFFDF5` / `oklch(45% 0.02 145)` | ~7.0:1 | 4.5:1 | AAA ✓ |
| Hover bg + label | `oklch(96% 0.015 145)` / `#0A1F0A` | ~17.5:1 | 4.5:1 | AAA ✓ |
| Top bar surface + page title | `--background` (`oklch(0.98 0.005 240)`) / `#0A1F0A` | ~18.5:1 | 4.5:1 | AAA ✓ |
| Admin badge: gold bg + earth text | `#F59E0B` / `#1C1917` | ~7.1:1 | 4.5:1 | AAA ✓ |
| Sidebar border on cream surface | `#FFFDF5` / `oklch(88% 0.02 145)` | ~3.1:1 | 3:1 (non-text UI) | ✓ |
| Focus ring on cream surface | `oklch(45% 0.15 145)` outline | ~4.5:1 | 3:1 (non-text UI) | ✓ |

### Brand colors that are NOT used as text

`--grass #22C55E` and `--gold #F59E0B` fail 4.5:1 against the cream surface (~2.7:1 and ~2.2:1 respectively). They are therefore used **only** as:

- Decorative leading icons next to text (the text itself carries the meaning and contrast).
- Background of badges where the text on the badge is dark `--earth` (verified 7.1:1 above).
- Avatar fill for the trainee footer chip with dark text.

No state, link, or label is conveyed by `grass` or `gold` color **alone**. Every meaningful state pairs color with an icon, weight, or shape change.

### Validation

- Every token pairing above is recomputed in a unit test (`src/lib/colors.test.ts`) using `oklch → sRGB → relative luminance → contrast` so that future token edits trip the test if any pairing slips below threshold.
- An `axe-core` smoke check runs against the sidebar in a Playwright e2e test (no jsdom — real browser, dark mode disabled, RTL on).

## Persistence

The shadcn primitive sets a `sidebar:state=expanded|collapsed` cookie on toggle. The provider reads it on mount and applies the matching default. No localStorage; cookie keeps the first paint correct on SSR. Cookie is per-user-agent, scoped to the site, `Path=/`, `SameSite=Lax`, no `httpOnly` (must be readable from client).

## Mobile (explicitly deferred)

Below `md` the sidebar is hidden via the primitive's built-in breakpoint handling. `AdminBottomNav` and `DashboardBottomNav` continue to render. No hamburger sheet on mobile in this spec — that's the next iteration.

## Testing

- **Unit (Vitest):** `src/lib/colors.test.ts` verifies every WCAG pairing in the table above. No mock data; pure color math.
- **Component (Vitest + RTL):** `AdminSidebar.test.tsx` and `DashboardSidebar.test.tsx` render with a fake `user`/`profile`, assert correct active state for each pathname, and assert `aria-current="page"`. Assert `סרטונים` is filtered out for `role: "trainer"`.
- **Playwright e2e:** one happy-path test per surface — login, click each section/item, assert URL transitions and sidebar active state.
- **Playwright a11y:** adds `@axe-core/playwright` as a new devDependency. Scans `/admin` and `/dashboard` with the sidebar both expanded and collapsed; zero violations of "color-contrast" and "aria-required-children".

## File-by-file change list

**Add:**
- `src/components/ui/sidebar.tsx` (vendored via `npx shadcn@latest add sidebar` — also pulls dependencies into existing `sheet.tsx` / `tooltip.tsx` if needed).
- `src/components/layout/AppSidebar.tsx`.
- `src/components/layout/AppTopBar.tsx`.
- `src/components/admin/AdminSidebar.tsx`.
- `src/components/dashboard/DashboardSidebar.tsx`.
- `src/lib/colors.ts` + `src/lib/colors.test.ts`.

**Modify:**
- `src/app/globals.css` — redefine the eight `--sidebar-*` tokens (light theme only).
- `src/app/admin/layout.tsx` — replace `<AdminNav>` with `<SidebarProvider><AdminSidebar/>...`.
- `src/app/dashboard/layout.tsx` — replace `<DashboardNav>` with `<SidebarProvider><DashboardSidebar/>...`.
- `package.json` — add `@axe-core/playwright` as a devDependency (only new package).

**Delete:**
- `src/components/admin/AdminNav.tsx`.
- `src/components/dashboard/DashboardNav.tsx`.

**Untouched:**
- `src/components/admin/AdminBottomNav.tsx`.
- `src/components/dashboard/DashboardBottomNav.tsx`.
- `src/components/landing/Navbar.tsx`.
- All page components under `src/app/admin/*` and `src/app/dashboard/*`.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Cookie-based persistence flickers on SSR if the cookie is not read in `layout.tsx` | shadcn primitive ships a `getSidebarStateFromCookie()` helper; pass to `<SidebarProvider defaultOpen={...}>`. Documented in their docs. |
| RTL collapse animation looks wrong on Safari | Smoke-test in Safari before merge; the primitive uses `transform` only — should work in all evergreen browsers. |
| Hover-only affordances inaccessible to keyboard users in collapsed mode | Tooltips are keyboard-triggered (focus-within), already handled by Radix `Tooltip`. |
| Page title in `AppTopBar` getting out of sync with `AdminNav` data | Both arrays live in the same module file — `AdminSidebar.tsx` exports both `NAV_SECTIONS` and `PAGE_TITLES`. Single source of truth. |
| Brand colors edited later breaking WCAG | Unit test in `colors.test.ts` recomputes every pairing on every CI run. |

## Open questions

None. All conceptual decisions resolved during brainstorm. Implementation-level details (e.g., exact `oklch` digits) verified above with measured ratios; the writing-plans step turns this into ordered tasks.
