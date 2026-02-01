# Phase 02: Admin Panel - User Management - Research

**Researched:** 2026-02-01
**Domain:** Admin user management with Supabase Auth Admin API, data tables, search/filter, CSV import/export
**Confidence:** HIGH

## Summary

This phase implements admin-only user management functionality including user creation (via Supabase Admin API), soft deletion, password reset, search/filter with pagination, and bulk CSV import/export. The existing codebase uses phone-based OTP authentication (no passwords), which informs the user creation approach - new users should receive an invite link or OTP rather than temporary passwords.

The standard approach uses:
- **Supabase Admin API** (`auth.admin.createUser`, `auth.admin.generateLink`) for user management via the existing `createAdminClient()`
- **TanStack Table** (to be installed) for data tables with sorting, filtering, pagination
- **nuqs** (to be installed) for type-safe URL state management of filters
- **PapaParse** (to be installed) for CSV parsing and generation
- **use-debounce** (to be installed) for debounced search

**Primary recommendation:** Use Next.js Server Actions for all admin mutations, TanStack Table for the data table, and follow existing OTP patterns for user credential delivery.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | ^2.89.0 | Admin Auth API | Already installed; `auth.admin.*` methods |
| `@tanstack/react-table` | ^8.21.x | Headless data table | Industry standard, works with any UI, shadcn/ui uses it |
| `nuqs` | ^2.x | URL state for filters | Type-safe search params, SSR support, Next.js optimized |
| `papaparse` | ^5.x | CSV parsing/generation | Fastest browser CSV parser, handles edge cases |
| `use-debounce` | ^10.x | Debounced search | Simple, lightweight, server-rendering friendly |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | ^4.2.1 | Validation | Already installed; validate user creation/CSV data |
| `sonner` | ^2.0.7 | Toast notifications | Already installed; success/error feedback |
| `react-hook-form` | ^7.69.0 | Form management | Already installed; user creation form |

### Already Installed (No Changes)

These are already in `package.json` and should be reused:
- `@supabase/ssr` ^0.8.0 - Server-side Supabase client
- `lucide-react` - Icons
- All shadcn/ui primitives

### Installation

```bash
npm install @tanstack/react-table nuqs papaparse use-debounce
npm install -D @types/papaparse
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/admin/users/
│   ├── page.tsx              # User list with data table
│   ├── create/
│   │   └── page.tsx          # User creation form page
│   └── [userId]/
│       └── page.tsx          # Existing: User profile/edit page
├── components/admin/
│   ├── users/
│   │   ├── UserDataTable.tsx         # TanStack Table wrapper
│   │   ├── UserTableColumns.tsx      # Column definitions
│   │   ├── UserTableToolbar.tsx      # Search + filters
│   │   ├── UserTablePagination.tsx   # Pagination controls
│   │   ├── UserCreateForm.tsx        # User creation form
│   │   ├── UserImportDialog.tsx      # CSV import modal
│   │   └── DeleteUserDialog.tsx      # Soft delete confirmation
│   └── UserEditForm.tsx              # Existing
├── lib/
│   ├── actions/
│   │   └── admin-users.ts    # Server actions for user management
│   └── validations/
│       ├── user-create.ts    # User creation schema
│       └── user-import.ts    # CSV import validation
└── types/
    └── database.ts           # Existing: includes Profile, deleted_at
```

### Pattern 1: Supabase Admin API for User Creation

**What:** Use `createAdminClient().auth.admin.createUser()` to create users server-side
**When to use:** Any admin-initiated user creation
**Source:** [Supabase Auth Admin API](https://supabase.com/docs/reference/javascript/auth-admin-createuser)

```typescript
// Source: Supabase official docs
import { createAdminClient } from "@/lib/supabase/admin";

// In server action
async function createUser(data: UserCreateInput) {
  const supabase = createAdminClient();

  // Create auth user with phone (existing pattern in this app)
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    phone: data.phone,
    phone_confirm: true, // Auto-confirm since admin is creating
    user_metadata: {
      full_name: data.full_name,
    },
  });

  if (authError) throw authError;

  // Profile is auto-created via database trigger
  // Update profile with additional fields
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      full_name: data.full_name,
      role: data.role,
    })
    .eq("id", authData.user.id);

  if (profileError) throw profileError;

  return authData.user;
}
```

### Pattern 2: Generate Invite Link for New Users

**What:** Generate magic link for new users to set up their account
**When to use:** Sending welcome credentials to new users
**Source:** [Supabase generateLink](https://supabase.com/docs/reference/javascript/auth-admin-generatelink)

```typescript
// Source: Supabase official docs
const { data, error } = await supabase.auth.admin.generateLink({
  type: "magiclink",
  email: user.email, // Or use phone-based OTP via signInWithOtp
  options: {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/onboarding`,
  },
});

// For phone-based (matching existing app pattern):
// Send OTP via signInWithOtp after creating user
```

### Pattern 3: Soft Delete with `deleted_at`

**What:** Set `deleted_at` timestamp instead of hard deleting
**When to use:** All user deletions
**Why:** Data preservation, audit trail, allows recovery

```typescript
// Server action
async function softDeleteUser(userId: string) {
  const supabase = createAdminClient();

  // Soft delete in profiles table
  const { error } = await supabase
    .from("profiles")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) throw error;

  // Log activity
  await supabase.from("activity_logs").insert({
    user_id: userId,
    action: "user_deleted",
    actor_id: adminId,
    actor_name: adminName,
  });
}
```

### Pattern 4: TanStack Table with Server-Side Data

**What:** Headless table with controlled state for server-side operations
**When to use:** Data tables with sorting, filtering, pagination
**Source:** [TanStack Table docs](https://tanstack.com/table/latest)

```typescript
// Source: TanStack Table official docs
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";

function UserDataTable({ data }: { data: Profile[] }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, pagination },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  // ... render using table.getHeaderGroups(), table.getRowModel()
}
```

### Pattern 5: URL State with nuqs

**What:** Persist filter/search state in URL for shareability and refresh persistence
**When to use:** Search bar, filter dropdowns, pagination
**Source:** [nuqs docs](https://nuqs.dev/)

```typescript
// Source: nuqs official docs
import { useQueryState, parseAsString, parseAsInteger } from "nuqs";

function UserTableToolbar() {
  const [search, setSearch] = useQueryState("q", parseAsString.withDefault(""));
  const [role, setRole] = useQueryState("role", parseAsString);
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));

  // Debounce search
  const [debouncedSearch] = useDebouncedValue(search, 300);

  // Use debouncedSearch for filtering
}
```

### Pattern 6: Debounced Search

**What:** Delay search API calls until user stops typing
**When to use:** Real-time search input
**Source:** [use-debounce npm](https://www.npmjs.com/package/use-debounce)

```typescript
// Source: use-debounce docs
import { useDebouncedValue } from "use-debounce";

function SearchInput() {
  const [value, setValue] = useState("");
  const [debouncedValue] = useDebouncedValue(value, 300);

  useEffect(() => {
    // API call with debouncedValue
  }, [debouncedValue]);
}
```

### Pattern 7: Server Actions with Validation

**What:** Type-safe server mutations with Zod validation
**When to use:** All admin mutations (create, delete, update)
**Source:** [Next.js Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)

```typescript
// Source: Next.js docs + existing codebase pattern
"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const createUserSchema = z.object({
  full_name: z.string().min(2).max(100),
  phone: z.string().regex(/^0\d{9}$|^\+972\d{9}$/),
  role: z.enum(["trainee", "trainer", "admin"]),
});

export async function createUser(input: z.infer<typeof createUserSchema>) {
  // Verify admin
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") return { error: "Forbidden" };

  // Validate input
  const validated = createUserSchema.safeParse(input);
  if (!validated.success) {
    return { error: validated.error.flatten().fieldErrors };
  }

  // Create user with admin client
  const adminSupabase = createAdminClient();
  // ... creation logic

  revalidatePath("/admin/users");
  return { success: true };
}
```

### Pattern 8: CSV Import with PapaParse

**What:** Parse CSV with validation, skip invalid rows, generate report
**When to use:** Bulk user import
**Source:** [PapaParse docs](https://www.papaparse.com/docs)

```typescript
// Source: PapaParse docs
import Papa from "papaparse";

interface CSVRow {
  name: string;
  phone: string;
  role: string;
  email?: string;
}

function parseUserCSV(file: File): Promise<{
  valid: CSVRow[];
  errors: { row: number; errors: string[] }[];
}> {
  return new Promise((resolve) => {
    Papa.parse<CSVRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const valid: CSVRow[] = [];
        const errors: { row: number; errors: string[] }[] = [];

        results.data.forEach((row, index) => {
          const validation = csvRowSchema.safeParse(row);
          if (validation.success) {
            valid.push(validation.data);
          } else {
            errors.push({
              row: index + 2, // +2 for header and 0-index
              errors: validation.error.issues.map(i => i.message),
            });
          }
        });

        resolve({ valid, errors });
      },
    });
  });
}
```

### Anti-Patterns to Avoid

- **Client-side Admin API calls:** Never expose service_role key in browser; always use Server Actions
- **Hard delete users:** Always soft delete with `deleted_at` for audit trail
- **Unvalidated CSV import:** Always validate each row before insert; skip invalid, report errors
- **Blocking search:** Always debounce search input (300-500ms)
- **Manual URL parsing:** Use nuqs for type-safe URL state; don't use raw `useSearchParams` with string manipulation

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Data table | Custom table with sort/filter | TanStack Table | Edge cases: multi-sort, column visibility, resize |
| CSV parsing | Manual string split | PapaParse | Handles quotes, escapes, large files, streaming |
| URL state | Manual searchParams | nuqs | Type safety, serializers, shallow updates |
| Debounce | setTimeout wrapper | use-debounce | Cleanup, SSR support, cancel semantics |
| User auth | Custom auth flows | Supabase Admin API | Security, session management, audit logs |

**Key insight:** User management has significant security implications (auth, permissions, audit). Using Supabase's Admin API ensures proper security handling and session management.

## Common Pitfalls

### Pitfall 1: Service Role Key Exposure

**What goes wrong:** Service role key exposed to client, allowing database bypass
**Why it happens:** Importing admin client in client components
**How to avoid:** Only use `createAdminClient()` in Server Actions or API routes; never in "use client" components
**Warning signs:** Type error about `createAdminClient` in client component; browser network tab shows service_role key

### Pitfall 2: Forgetting to Verify Admin Role

**What goes wrong:** Non-admin users can execute admin actions
**Why it happens:** Server action trusts auth alone without role check
**How to avoid:** Every server action must verify `profile.role === 'admin'` before proceeding
**Warning signs:** Actions succeed without checking current user's profile

### Pitfall 3: Race Condition in Auth User + Profile Creation

**What goes wrong:** Profile update fails because trigger hasn't created profile yet
**Why it happens:** `auth.admin.createUser()` triggers profile creation async
**How to avoid:** Use `upsert` instead of `update`, or add small delay/retry logic
**Warning signs:** "No rows updated" errors intermittently on user creation

### Pitfall 4: CSV Import Without Row-Level Validation

**What goes wrong:** Entire import fails on first invalid row
**Why it happens:** Bulk insert with one invalid entry
**How to avoid:** Validate each row, collect valid rows, insert in batch, report errors separately
**Warning signs:** Import fails with cryptic database error; users don't know which row failed

### Pitfall 5: Search Without Debounce

**What goes wrong:** API overwhelmed with requests on each keystroke
**Why it happens:** Triggering search on every `onChange`
**How to avoid:** Debounce 300-500ms; show loading indicator during debounce
**Warning signs:** Network tab shows many rapid requests; UI feels laggy

### Pitfall 6: Filter State Lost on Refresh

**What goes wrong:** User's filter selections disappear on page refresh
**Why it happens:** Storing filter state only in React state
**How to avoid:** Use URL state via nuqs; all filters reflected in URL params
**Warning signs:** Copying URL to share doesn't preserve filter view

### Pitfall 7: Soft Delete Without Unique Index Adjustment

**What goes wrong:** Can't recreate user with same phone after soft delete
**Why it happens:** Unique constraint includes deleted records
**How to avoid:** Already handled in Phase 1 - partial unique indexes WHERE deleted_at IS NULL
**Warning signs:** Duplicate key error when creating user with previously deleted phone

## Code Examples

### User Creation Form with Server Action

```typescript
// src/lib/actions/admin-users.ts
"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const createUserSchema = z.object({
  full_name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().regex(/^0\d{9}$|^\+972\d{9}$/, "Invalid phone format"),
  role: z.enum(["trainee", "trainer", "admin"]),
  email: z.string().email().optional().or(z.literal("")),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export async function createUserAction(input: CreateUserInput) {
  // 1. Verify admin
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (adminProfile?.role !== "admin") {
    return { error: "Admin access required" };
  }

  // 2. Validate input
  const validated = createUserSchema.safeParse(input);
  if (!validated.success) {
    return {
      error: "Validation failed",
      fieldErrors: validated.error.flatten().fieldErrors
    };
  }

  const { full_name, phone, role, email } = validated.data;

  // 3. Format phone for Supabase
  const formattedPhone = phone.startsWith("+")
    ? phone
    : `+972${phone.slice(1)}`;

  // 4. Create user with admin client
  const adminClient = createAdminClient();

  try {
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      phone: formattedPhone,
      phone_confirm: true,
      email: email || undefined,
      email_confirm: !!email,
      user_metadata: { full_name },
    });

    if (authError) {
      if (authError.message.includes("already registered")) {
        return { error: "Phone number already registered" };
      }
      throw authError;
    }

    // 5. Update profile with role
    const { error: profileError } = await adminClient
      .from("profiles")
      .update({
        full_name,
        role,
        phone: formattedPhone,
      })
      .eq("id", authData.user.id);

    if (profileError) throw profileError;

    // 6. Log activity
    await adminClient.from("activity_logs").insert({
      user_id: authData.user.id,
      action: "user_created",
      actor_id: user.id,
      actor_name: adminProfile.full_name,
      changes: [
        { field: "role", old_value: null, new_value: role },
      ],
    });

    // 7. Revalidate
    revalidatePath("/admin/users");

    return { success: true, userId: authData.user.id };

  } catch (error) {
    console.error("Create user error:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to create user"
    };
  }
}
```

### Soft Delete Server Action

```typescript
// src/lib/actions/admin-users.ts (continued)
export async function deleteUserAction(userId: string) {
  // Verify admin (same pattern as above)
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

  // Prevent self-deletion
  if (userId === user.id) {
    return { error: "Cannot delete your own account" };
  }

  const adminClient = createAdminClient();

  try {
    // Soft delete in profiles
    const { error } = await adminClient
      .from("profiles")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", userId);

    if (error) throw error;

    // Log activity
    await adminClient.from("activity_logs").insert({
      user_id: userId,
      action: "user_deleted",
      actor_id: user.id,
      actor_name: adminProfile.full_name,
    });

    revalidatePath("/admin/users");
    return { success: true };

  } catch (error) {
    console.error("Delete user error:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to delete user"
    };
  }
}
```

### Password Reset (Generate Magic Link)

```typescript
// Since this app uses OTP, "password reset" means sending new login link
export async function resetUserCredentialsAction(userId: string) {
  // Verify admin
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (adminProfile?.role !== "admin") {
    return { error: "Admin access required" };
  }

  const adminClient = createAdminClient();

  // Get user's contact info
  const { data: targetUser } = await adminClient.auth.admin.getUserById(userId);

  if (!targetUser?.user) {
    return { error: "User not found" };
  }

  // Generate magic link (phone or email based on what's available)
  if (targetUser.user.phone) {
    // For phone users, trigger OTP
    const { error } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      phone: targetUser.user.phone,
    });

    if (error) throw error;

    // Note: For actual SMS delivery, you'd need to handle this separately
    // Supabase doesn't automatically send the link
  } else if (targetUser.user.email) {
    const { data, error } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email: targetUser.user.email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
      },
    });

    if (error) throw error;

    // In production, send this link via your email service
    console.log("Magic link generated:", data.properties?.action_link);
  }

  return { success: true };
}
```

### CSV Export

```typescript
// Client-side CSV export
function exportUsersToCSV(users: Profile[]) {
  const csvData = users.map(user => ({
    name: user.full_name || "",
    phone: user.phone || "",
    role: user.role,
    email: "", // Add if available
    status: user.is_active ? "active" : "inactive",
    created: user.created_at,
  }));

  const csv = Papa.unparse(csvData);

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `users-export-${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| React Table v7 | TanStack Table v8 | 2022 | Headless, type-safe, smaller bundle |
| Manual URL params | nuqs | 2023-2024 | Type-safe, SSR-friendly, hooks API |
| Custom debounce | use-debounce library | Standard | Proper cleanup, SSR support |
| API routes for mutations | Server Actions | Next.js 14+ | Simpler, co-located, progressive enhancement |

**Deprecated/outdated:**
- `react-table` (v7): Replaced by `@tanstack/react-table` (v8) - different API
- Manual `useSearchParams` + `router.push`: Use nuqs for cleaner code
- Creating users via client-side signUp: Use admin.createUser for admin-created users

## Open Questions

1. **SMS Delivery for Password Reset**
   - What we know: `auth.admin.generateLink` creates a magic link but doesn't send it
   - What's unclear: How to trigger SMS delivery for phone-only users
   - Recommendation: For MVP, focus on users with email; phone-only users can use normal login flow. Future: integrate SMS service (Twilio/MessageBird configured in Supabase)

2. **Bulk Status Update UI**
   - What we know: Technically possible with batch update server action
   - What's unclear: Best UX - checkboxes in table vs. separate bulk action modal
   - Recommendation (Claude's discretion): Start with individual actions on user profile page; add bulk selection later if needed. Matches "keep list clean" decision from CONTEXT.md

3. **Payment Status Integration**
   - What we know: Table should show Payment Status column
   - What's unclear: Source of payment status data (separate payments table? profile field?)
   - Recommendation: Check `payments` table join; display last payment status. Defer complex payment logic to future phase

## Sources

### Primary (HIGH confidence)
- [Supabase Auth Admin API](https://supabase.com/docs/reference/javascript/admin-api) - createUser, deleteUser, generateLink
- [TanStack Table](https://tanstack.com/table/latest) - Table state, sorting, filtering, pagination
- [nuqs](https://nuqs.dev/) - URL state management
- [PapaParse](https://www.papaparse.com/docs) - CSV parsing

### Secondary (MEDIUM confidence)
- [Next.js Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations) - Mutation patterns
- [shadcn/ui Data Table](https://ui.shadcn.com/docs/components/data-table) - TanStack + shadcn integration
- [use-debounce](https://www.npmjs.com/package/use-debounce) - Debounce hooks

### Tertiary (LOW confidence)
- WebSearch results for best practices - Cross-verified with official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Libraries are well-documented, widely used, verified via Context7 and official docs
- Architecture: HIGH - Patterns based on existing codebase patterns and official docs
- Pitfalls: HIGH - Common issues documented in official sources and verified against codebase

**Research date:** 2026-02-01
**Valid until:** 2026-03-01 (30 days - stable domain)

---

*Phase: 02-user-management*
*Research complete: Ready for planning*
