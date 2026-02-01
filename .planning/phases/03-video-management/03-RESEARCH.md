# Phase 03: Admin Panel - Video Management - Research

**Researched:** 2026-02-01
**Domain:** Admin video CRUD with TanStack Table, YouTube URL parsing, form validation
**Confidence:** HIGH

## Summary

This phase implements admin-only video management functionality including video creation, editing, and deletion with confirmation dialogs. The existing codebase has a read-only video display page (`/admin/videos/page.tsx`) that needs to be upgraded to a full CRUD interface following the same patterns established in Phase 2 (User Management).

The standard approach uses:
- **Existing TanStack Table setup** - Already installed and used in Phase 2; follow `UserDataTable` pattern
- **Existing server action patterns** - Follow `admin-users.ts` with `verifyAdmin()` helper and `ActionResult` type
- **YouTube URL parsing** - Existing `getYouTubeId()` function in `VideoCard.tsx` handles multiple URL formats
- **Form pattern** - react-hook-form + zod + shadcn/ui Form, following `UserCreateForm` pattern
- **Delete confirmation** - AlertDialog pattern from `DeleteUserDialog`

**Primary recommendation:** Reuse all existing patterns from Phase 2. No new libraries needed. Focus on adapting the user management table/form/action patterns to video entities.

## Standard Stack

### Core (Already Installed - No Changes)

| Library | Version | Purpose | Already Used In |
|---------|---------|---------|-----------------|
| `@tanstack/react-table` | ^8.21.3 | Data table with sorting, pagination | `UserDataTable.tsx` |
| `react-hook-form` | ^7.69.0 | Form state management | `UserCreateForm.tsx` |
| `zod` | ^4.2.1 | Schema validation | `user-create.ts` |
| `nuqs` | ^2.8.7 | URL state for filters | `UserTableToolbar.tsx` |
| `sonner` | ^2.0.7 | Toast notifications | Throughout admin |

### Supporting (Already Installed)

| Library | Version | Purpose | Used For |
|---------|---------|---------|----------|
| `lucide-react` | ^0.562.0 | Icons | Video, Play, Clock, Trash2, Edit, Plus |
| `use-debounce` | ^10.1.0 | Debounced search | Search input (if added) |

### No New Dependencies Required

All required libraries are already in `package.json`. This phase purely adds new components/actions following established patterns.

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/admin/videos/
│   ├── page.tsx              # Video list with data table (upgrade existing)
│   └── create/
│       └── page.tsx          # Video creation form page
├── components/admin/videos/
│   ├── VideoDataTable.tsx    # TanStack Table wrapper
│   ├── VideoTableColumns.tsx # Column definitions with thumbnail
│   ├── VideoTableToolbar.tsx # Search + day filter
│   ├── VideoTablePagination.tsx # Pagination controls
│   ├── VideoForm.tsx         # Create/Edit form (shared)
│   └── DeleteVideoDialog.tsx # Delete confirmation
├── lib/
│   ├── actions/
│   │   └── admin-videos.ts   # Server actions for video CRUD
│   └── validations/
│       └── video.ts          # Video validation schema
└── types/
    └── database.ts           # Already has WorkoutVideo type
```

### Pattern 1: Server Action with verifyAdmin Helper

**What:** Reuse the centralized admin verification pattern from Phase 2
**When to use:** Every admin mutation (create, update, delete video)
**Source:** Existing codebase (`admin-users.ts`)

```typescript
// Source: src/lib/actions/admin-users.ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

type ActionResult =
  | { success: true; videoId?: string }
  | { error: string; fieldErrors?: Record<string, string[]> };

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" as const, user: null, adminProfile: null };
  }

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (adminProfile?.role !== "admin") {
    return { error: "Admin access required" as const, user: null, adminProfile: null };
  }

  return { error: null, user, adminProfile };
}
```

### Pattern 2: YouTube URL Validation and ID Extraction

**What:** Accept multiple YouTube URL formats, extract video ID for embedding/thumbnails
**When to use:** Video form validation and display
**Source:** Existing codebase (`VideoCard.tsx`)

```typescript
// Source: src/components/dashboard/VideoCard.tsx
// Supports: youtube.com/watch, youtube.com/shorts, youtu.be formats
const getYouTubeId = (url: string): string | null => {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/(?:shorts\/)?)([^&?]+)/);
  return match ? match[1] : null;
};

// For validation in zod schema:
const youtubeUrlSchema = z.string()
  .url("קישור לא תקין")
  .refine((url) => getYouTubeId(url) !== null, {
    message: "קישור YouTube לא תקין",
  });
```

### Pattern 3: TanStack Table Column Definitions

**What:** Define columns with sortable headers, thumbnail display, actions
**When to use:** Video table display
**Source:** Existing codebase (`UserTableColumns.tsx`) + Context7 TanStack Table

```typescript
// Source: src/components/admin/users/UserTableColumns.tsx pattern
import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WorkoutVideo } from "@/types/database";

export const columns: ColumnDef<WorkoutVideo>[] = [
  {
    id: "thumbnail",
    header: "",
    cell: ({ row }) => {
      const youtubeId = getYouTubeId(row.original.youtube_url);
      return youtubeId ? (
        <img
          src={`https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`}
          alt={row.original.title}
          className="w-24 h-14 object-cover rounded"
        />
      ) : null;
    },
    enableSorting: false,
  },
  {
    accessorKey: "title",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        כותרת
        <ArrowUpDown className="mr-2 h-4 w-4" />
      </Button>
    ),
  },
  {
    accessorKey: "day_number",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        יום
        <ArrowUpDown className="mr-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => <Badge variant="outline">יום {row.getValue("day_number")}</Badge>,
  },
  {
    accessorKey: "duration_minutes",
    header: "משך",
    cell: ({ row }) => `${row.getValue("duration_minutes")} דקות`,
  },
];
```

### Pattern 4: Form with react-hook-form + zod

**What:** Video creation/edit form with validation
**When to use:** Create and edit video dialogs/pages
**Source:** Existing codebase (`UserCreateForm.tsx`)

```typescript
// Source: src/components/admin/users/UserCreateForm.tsx pattern
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { videoSchema, type VideoInput } from "@/lib/validations/video";
import { createVideoAction } from "@/lib/actions/admin-videos";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "sonner";

export function VideoForm({ video, onSuccess }: VideoFormProps) {
  const form = useForm<VideoInput>({
    resolver: zodResolver(videoSchema),
    defaultValues: video || {
      title: "",
      youtube_url: "",
      day_number: 1,
      day_topic: "",
      duration_minutes: 5,
      description: "",
    },
  });

  const onSubmit = async (data: VideoInput) => {
    setLoading(true);
    try {
      const result = video
        ? await updateVideoAction(video.id, data)
        : await createVideoAction(data);

      if (!("success" in result)) {
        if (result.fieldErrors) {
          Object.entries(result.fieldErrors).forEach(([field, errors]) => {
            form.setError(field as keyof VideoInput, { message: errors[0] });
          });
        }
        toast.error(result.error);
        return;
      }

      toast.success(video ? "הסרטון עודכן בהצלחה!" : "הסרטון נוסף בהצלחה!");
      onSuccess?.();
    } finally {
      setLoading(false);
    }
  };
}
```

### Pattern 5: AlertDialog for Destructive Actions

**What:** Confirmation dialog with loading state for delete operations
**When to use:** Video deletion
**Source:** Existing codebase (`DeleteUserDialog.tsx`)

```typescript
// Source: src/components/admin/users/DeleteUserDialog.tsx pattern
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

export function DeleteVideoDialog({ video, trigger }: DeleteVideoDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      const result = await deleteVideoAction(video.id);
      if (!("success" in result)) {
        toast.error(result.error);
        return;
      }
      toast.success("הסרטון נמחק בהצלחה");
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      {/* ... dialog content with loading state */}
    </AlertDialog>
  );
}
```

### Anti-Patterns to Avoid

- **Direct database mutations in client components:** Always use Server Actions
- **Missing admin verification:** Every server action must call `verifyAdmin()` first
- **Hard-coding YouTube thumbnail URLs:** Always extract video ID and construct URL dynamically
- **Inline edit without confirmation:** Use AlertDialog for destructive actions (delete)
- **Forgetting revalidatePath:** Call `revalidatePath("/admin/videos")` after mutations

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YouTube ID extraction | Custom regex without testing | Existing `getYouTubeId()` function | Already handles watch, shorts, youtu.be |
| Thumbnail URLs | YouTube API calls | Direct img.youtube.com URLs | No API key needed, instant |
| Data table | Custom table with sort/filter | TanStack Table (already used) | Battle-tested, accessible |
| Form validation | Manual validation | zod + react-hook-form | Type-safe, declarative |
| Delete confirmation | window.confirm() | AlertDialog component | Accessible, styled |

**Key insight:** This phase is a direct adaptation of Phase 2 patterns. All infrastructure exists - the work is applying it to the video entity.

## Common Pitfalls

### Pitfall 1: Forgetting to Handle order_index on Create

**What goes wrong:** New videos don't appear in expected position
**Why it happens:** `order_index` not auto-calculated
**How to avoid:** Server action should query max order_index for the day and increment
**Warning signs:** Videos appear at beginning or with duplicate order

```typescript
// Solution: Auto-calculate order_index
const { data: maxOrder } = await adminClient
  .from("workout_videos")
  .select("order_index")
  .eq("day_number", data.day_number)
  .order("order_index", { ascending: false })
  .limit(1)
  .single();

const newOrderIndex = (maxOrder?.order_index ?? 0) + 1;
```

### Pitfall 2: Invalid YouTube URLs Not Caught

**What goes wrong:** Videos saved but thumbnails/embeds don't work
**Why it happens:** URL validation passes but ID extraction fails
**How to avoid:** Validate URL AND verify ID can be extracted in zod schema
**Warning signs:** Broken thumbnail images, embed errors

### Pitfall 3: Edit Form Not Populating Existing Values

**What goes wrong:** Form shows empty fields when editing
**Why it happens:** Default values not set from existing video
**How to avoid:** Pass video data to form defaultValues; use `form.reset(video)` if needed
**Warning signs:** Edit mode behaves like create mode

### Pitfall 4: Missing RLS Policy for Admin Updates

**What goes wrong:** Admin can view but not edit/delete videos
**Why it happens:** Existing RLS has SELECT for authenticated but ALL only for admin check
**How to avoid:** Verify `"Admins can manage videos"` policy exists (already in schema.sql)
**Warning signs:** "Row-level security policy violated" errors

### Pitfall 5: Day Number Validation Out of Range

**What goes wrong:** Videos created for day 6, 7, etc.
**Why it happens:** Form accepts any number, validation doesn't enforce 1-5
**How to avoid:** Zod schema: `day_number: z.number().min(1).max(5)`
**Warning signs:** Database CHECK constraint fails or invalid days appear

### Pitfall 6: Duration as String Instead of Number

**What goes wrong:** Duration comparison/sorting fails
**Why it happens:** Input returns string, not coerced to number
**How to avoid:** Use `z.coerce.number()` in zod schema or `valueAsNumber` in input
**Warning signs:** TypeScript errors, NaN in display

## Code Examples

### Video Validation Schema

```typescript
// src/lib/validations/video.ts
import { z } from "zod";

// YouTube URL validation with ID extraction
function isValidYouTubeUrl(url: string): boolean {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/(?:shorts\/)?)([^&?]+)/);
  return match !== null && match[1].length === 11;
}

// Day topics (Hebrew)
const dayTopics = [
  "גמישות ויציבות",
  "כוח רגליים",
  "זריזות וקואורדינציה",
  "סיבולת לב-ריאה",
  "שיקום והתאוששות",
] as const;

export const videoSchema = z.object({
  title: z
    .string()
    .min(2, "כותרת חייבת להכיל לפחות 2 תווים")
    .max(200, "כותרת ארוכה מדי"),

  youtube_url: z
    .string()
    .url("קישור לא תקין")
    .refine(isValidYouTubeUrl, {
      message: "קישור YouTube לא תקין (פורמטים נתמכים: youtube.com/watch, youtu.be, youtube.com/shorts)",
    }),

  day_number: z
    .coerce
    .number()
    .min(1, "יום חייב להיות בין 1-5")
    .max(5, "יום חייב להיות בין 1-5"),

  day_topic: z
    .string()
    .min(2, "נושא היום חייב להכיל לפחות 2 תווים"),

  duration_minutes: z
    .coerce
    .number()
    .min(1, "משך חייב להיות לפחות דקה אחת")
    .max(120, "משך לא יכול לעלות על 120 דקות"),

  description: z
    .string()
    .max(1000, "תיאור ארוך מדי")
    .optional()
    .or(z.literal("")),

  order_index: z
    .coerce
    .number()
    .optional(), // Auto-calculated if not provided
});

export type VideoInput = z.infer<typeof videoSchema>;

// Helper for day topic suggestions
export function getDayTopicSuggestion(dayNumber: number): string {
  return dayTopics[dayNumber - 1] || "";
}
```

### Video Server Actions

```typescript
// src/lib/actions/admin-videos.ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { videoSchema, type VideoInput } from "@/lib/validations/video";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ActionResult =
  | { success: true; videoId?: string }
  | { error: string; fieldErrors?: Record<string, string[]> };

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" as const, user: null, adminProfile: null };
  }

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (adminProfile?.role !== "admin") {
    return { error: "Admin access required" as const, user: null, adminProfile: null };
  }

  return { error: null, user, adminProfile };
}

export async function createVideoAction(input: VideoInput): Promise<ActionResult> {
  // 1. Verify admin
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };

  // 2. Validate input
  const validated = videoSchema.safeParse(input);
  if (!validated.success) {
    return {
      error: "אימות נתונים נכשל",
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const adminClient = createAdminClient();

  try {
    // 3. Calculate order_index
    const { data: maxOrder } = await adminClient
      .from("workout_videos")
      .select("order_index")
      .eq("day_number", validated.data.day_number)
      .order("order_index", { ascending: false })
      .limit(1)
      .single();

    const orderIndex = validated.data.order_index ?? (maxOrder?.order_index ?? 0) + 1;

    // 4. Insert video
    const { data: video, error: insertError } = await adminClient
      .from("workout_videos")
      .insert({
        ...validated.data,
        order_index: orderIndex,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert video error:", insertError);
      return { error: insertError.message || "שגיאה בהוספת סרטון" };
    }

    // 5. Revalidate
    revalidatePath("/admin/videos");

    return { success: true, videoId: video.id };

  } catch (error) {
    console.error("Create video error:", error);
    return {
      error: error instanceof Error ? error.message : "שגיאה בהוספת סרטון",
    };
  }
}

export async function updateVideoAction(
  videoId: string,
  input: VideoInput
): Promise<ActionResult> {
  // 1. Verify admin
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };

  // 2. Validate videoId
  if (!UUID_REGEX.test(videoId)) {
    return { error: "מזהה סרטון לא תקין" };
  }

  // 3. Validate input
  const validated = videoSchema.safeParse(input);
  if (!validated.success) {
    return {
      error: "אימות נתונים נכשל",
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const adminClient = createAdminClient();

  try {
    const { error: updateError } = await adminClient
      .from("workout_videos")
      .update(validated.data)
      .eq("id", videoId);

    if (updateError) {
      console.error("Update video error:", updateError);
      return { error: updateError.message || "שגיאה בעדכון סרטון" };
    }

    revalidatePath("/admin/videos");

    return { success: true, videoId };

  } catch (error) {
    console.error("Update video error:", error);
    return {
      error: error instanceof Error ? error.message : "שגיאה בעדכון סרטון",
    };
  }
}

export async function deleteVideoAction(videoId: string): Promise<ActionResult> {
  // 1. Verify admin
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };

  // 2. Validate videoId
  if (!UUID_REGEX.test(videoId)) {
    return { error: "מזהה סרטון לא תקין" };
  }

  const adminClient = createAdminClient();

  try {
    // Note: This is a hard delete. video_progress entries will cascade delete.
    const { error: deleteError } = await adminClient
      .from("workout_videos")
      .delete()
      .eq("id", videoId);

    if (deleteError) {
      console.error("Delete video error:", deleteError);
      return { error: deleteError.message || "שגיאה במחיקת סרטון" };
    }

    revalidatePath("/admin/videos");

    return { success: true };

  } catch (error) {
    console.error("Delete video error:", error);
    return {
      error: error instanceof Error ? error.message : "שגיאה במחיקת סרטון",
    };
  }
}
```

### YouTube ID Extraction Utility

```typescript
// src/lib/utils/youtube.ts
/**
 * Extract YouTube video ID from various URL formats
 * Supports:
 * - youtube.com/watch?v=VIDEO_ID
 * - youtube.com/shorts/VIDEO_ID
 * - youtu.be/VIDEO_ID
 * - youtu.be/shorts/VIDEO_ID
 * - youtube.com/embed/VIDEO_ID
 *
 * @returns 11-character video ID or null if invalid
 */
export function getYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/(?:shorts\/)?)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

/**
 * Get YouTube thumbnail URL from video ID
 * @param videoId - 11-character YouTube video ID
 * @param quality - Thumbnail quality (default: mqdefault for 320x180)
 */
export function getYouTubeThumbnail(
  videoId: string,
  quality: "default" | "mqdefault" | "hqdefault" | "sddefault" | "maxresdefault" = "mqdefault"
): string {
  return `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
}

/**
 * Get YouTube embed URL for iframe
 */
export function getYouTubeEmbedUrl(videoId: string, autoplay = false): string {
  return `https://www.youtube.com/embed/${videoId}${autoplay ? "?autoplay=1" : ""}`;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual table HTML | TanStack Table v8 | 2022 | Headless, accessible, sortable |
| window.confirm() | Radix AlertDialog | shadcn/ui | Accessible, styled, async support |
| Custom form state | react-hook-form v7 | Standard | Validation, error handling |
| Direct SQL in components | Server Actions | Next.js 14+ | Security, revalidation |

**Deprecated/outdated:**
- Direct Supabase mutations in client components: Always use Server Actions
- YouTube Data API for thumbnails: Direct `img.youtube.com` URLs work without API key

## Open Questions

1. **Edit UI: Dialog vs Page**
   - What we know: User management uses separate `/create` page
   - What's unclear: Should video edit be dialog (inline) or page (full form)?
   - Recommendation (Claude's discretion): Use Dialog for edit since video form is simpler than user form. Create can be a page OR dialog - consistent with edit is fine. Start with dialog for both since the form is compact.

2. **Extended Fields from CONTEXT.md**
   - What we know: CONTEXT mentions additional fields (thumbnail override, target audience, difficulty level)
   - What's unclear: Whether to add these now or defer
   - Recommendation: Current database schema only has core fields. Adding new fields requires migration. Implement core CRUD first, add extended fields as enhancement task within this phase if time permits.

3. **Day Topic Auto-Fill**
   - What we know: Each day has a standard topic (defined in VideoCard and current videos page)
   - What's unclear: Should topic be editable or locked to day number?
   - Recommendation: Make it editable with auto-suggestion on day change. Store as-entered to allow customization.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/lib/actions/admin-users.ts` - Server action patterns
- Existing codebase: `src/components/admin/users/` - Table, form, dialog patterns
- Existing codebase: `src/components/dashboard/VideoCard.tsx` - YouTube URL handling
- [TanStack Table](https://tanstack.com/table/latest) via Context7 - Column definitions, pagination
- [shadcn/ui AlertDialog](https://ui.shadcn.com/docs/components/alert-dialog) - Delete confirmation pattern

### Secondary (MEDIUM confidence)
- [YouTube Thumbnail URLs](https://gist.github.com/a1ip/be4514c1fd392a8c13b05e082c4da363) - img.youtube.com URL formats
- [YouTube Video ID extraction](https://gist.github.com/takien/4077195) - Regex patterns for URL parsing

### Tertiary (LOW confidence)
- None - all patterns verified against existing codebase and official documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and used in Phase 2
- Architecture: HIGH - Directly following established codebase patterns
- Pitfalls: HIGH - Based on Phase 2 implementation experience and codebase analysis

**Research date:** 2026-02-01
**Valid until:** 2026-03-01 (30 days - stable domain, patterns established)

---

*Phase: 03-video-management*
*Research complete: Ready for planning*
