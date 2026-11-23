import "server-only";

import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

/**
 * The signed-in user, verified with Supabase Auth once per request.
 *
 * `auth.getUser()` is a network round trip to Supabase Auth. A single page
 * render reaches it from the layout, the page and every loader or action the
 * page calls, so without sharing it ran several times per page. React
 * `cache()` keeps one answer per server request; it is never shared between
 * requests or users. Where React has no request scope `cache()` simply calls
 * through, so such callers behave exactly as before.
 *
 * Use it only to read who is signed in. Code that signs in or out reads the
 * session from its own client after the change.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * The signed-in user's own profile row (every column), read once per request.
 * Null when nobody is signed in, the row is missing, or the read failed (the
 * failure is logged). Soft-deleted rows are returned as they are, like the
 * per-page reads this replaces; callers that must refuse them check
 * `deleted_at`.
 *
 * Read only: the cached row does not see a write made later in the same
 * render.
 */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[getCurrentProfile] profile read failed:", error.message);
    return null;
  }
  return data;
});
