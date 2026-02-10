---
name: migration
description: Create and apply a new Supabase database migration with RLS validation
disable-model-invocation: true
---

# Create Database Migration

Create and apply a new Supabase migration following project conventions.

## Steps

1. **Ask** the user what the migration should do (if not already specified).
2. **Generate the SQL** for the migration.
3. **Name convention**: Use Supabase timestamp format (`YYYYMMDDHHMMSS_description.sql`). Generate the timestamp from the current time. Description in snake_case.
4. **RLS reminder**: If creating new tables, ALWAYS include:
   - `ALTER TABLE <name> ENABLE ROW LEVEL SECURITY;`
   - At least one RLS policy (ask the user who should have access)
5. **Apply** the migration using the Supabase MCP `apply_migration` tool with the project ID `sedqdnpdvwpivrocdlmh`.
6. **Verify** by running the Supabase MCP `get_advisors` tool (security type) to check for missing RLS policies or other issues.
7. **Save** the migration file locally to `supabase/migrations/<name>.sql` for version control.

## Important

- Do NOT hardcode generated IDs in data migrations.
- For `DECIMAL` columns on assessments, follow existing conventions: `DECIMAL(5,3)` for sprints, `DECIMAL(5,1)` for jumps, `DECIMAL(5,2)` for kaiser.
- Always check existing migrations in `supabase/migrations/` to avoid conflicts.
