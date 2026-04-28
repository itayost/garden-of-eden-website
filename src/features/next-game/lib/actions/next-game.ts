"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { typedFrom, upsertIntoTable } from "@/lib/supabase/helpers";
import { nextGameSchema, type NextGameInput } from "@/lib/validations/next-game";

export interface NextGameRow {
  readonly id: string;
  readonly user_id: string;
  readonly game_date: string;
  readonly opponent: string;
  readonly updated_at: string;
}

export type ActionResult =
  | { success: true; error?: never }
  | { success: false; error: string };

async function getTraineeUserId(): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "לא מחובר" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .is("deleted_at", null)
    .single();

  if ((profile as { role?: string } | null)?.role !== "trainee") {
    return { ok: false, error: "פעולה זו זמינה רק לשחקנים" };
  }

  return { ok: true, userId: user.id };
}

export async function getOwnNextGame(): Promise<NextGameRow | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await typedFrom(supabase, "trainee_next_games")
    .select("id, user_id, game_date, opponent, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  return (data as NextGameRow | null) ?? null;
}

export async function upsertNextGame(input: NextGameInput): Promise<ActionResult> {
  const parsed = nextGameSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים",
    };
  }

  const auth = await getTraineeUserId();
  if (!auth.ok) return { success: false, error: auth.error };

  const supabase = await createClient();
  const { error } = await upsertIntoTable(supabase, "trainee_next_games", {
    user_id: auth.userId,
    game_date: parsed.data.game_date,
    opponent: parsed.data.opponent,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error("[upsertNextGame] error:", error);
    return { success: false, error: "שגיאה בשמירת המשחק" };
  }

  revalidatePath("/dashboard");
  revalidatePath("/admin/upcoming-games");
  return { success: true };
}

export async function clearOwnNextGame(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "לא מחובר" };

  const { error } = await typedFrom(supabase, "trainee_next_games")
    .delete()
    .eq("user_id", user.id);

  if (error) {
    console.error("[clearOwnNextGame] error:", error);
    return { success: false, error: "שגיאה במחיקת המשחק" };
  }

  revalidatePath("/dashboard");
  revalidatePath("/admin/upcoming-games");
  return { success: true };
}
