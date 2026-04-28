"use server";

import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";

export interface AdminNextGameRow {
  readonly id: string;
  readonly user_id: string;
  readonly game_date: string;
  readonly opponent: string;
  readonly updated_at: string;
  readonly full_name: string | null;
  readonly phone: string | null;
}

export async function getUpcomingGames(): Promise<readonly AdminNextGameRow[]> {
  const { error } = await verifyAdminOrTrainer();
  if (error) return [];

  const supabase = await createClient();
  const { data } = await typedFrom(supabase, "trainee_next_games")
    .select("id, user_id, game_date, opponent, updated_at, profiles!inner(full_name, phone)")
    .order("game_date", { ascending: true });

  if (!data) return [];

  return (data as Array<{
    id: string;
    user_id: string;
    game_date: string;
    opponent: string;
    updated_at: string;
    profiles: { full_name: string | null; phone: string | null } | null;
  }>).map((row) => ({
    id: row.id,
    user_id: row.user_id,
    game_date: row.game_date,
    opponent: row.opponent,
    updated_at: row.updated_at,
    full_name: row.profiles?.full_name ?? null,
    phone: row.profiles?.phone ?? null,
  }));
}

export async function getUserNextGameForAdmin(
  userId: string,
): Promise<{ game_date: string; opponent: string; updated_at: string } | null> {
  const { error } = await verifyAdminOrTrainer();
  if (error) return null;

  const supabase = await createClient();
  const { data } = await typedFrom(supabase, "trainee_next_games")
    .select("game_date, opponent, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  return (data as { game_date: string; opponent: string; updated_at: string } | null) ?? null;
}
