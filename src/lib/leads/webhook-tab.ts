import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { typedFrom } from "@/lib/supabase/helpers";
import { deriveLeadTabSlug, nextFreeLeadTabSlug } from "@/lib/validations/lead-tabs";

export type WebhookTab =
  | { tabId: string; slug: string; created: boolean }
  | { error: string; status: number };

/** The live tab with this slug, or an error the webhook answers with. */
export async function tabBySlug(supabase: SupabaseClient, slug: string): Promise<WebhookTab> {
  const { data, error } = await typedFrom(supabase, "lead_tabs")
    .select("id, slug")
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) {
    console.error("[Leads Webhook] Tab read error:", error);
    return { error: "Failed to read tab", status: 500 };
  }
  if (!data) return { error: "Invalid tab_slug", status: 400 };
  return { tabId: data.id as string, slug: data.slug as string, created: false };
}

async function liveTabByName(supabase: SupabaseClient, name: string) {
  return typedFrom(supabase, "lead_tabs")
    .select("id, slug")
    .eq("name", name)
    .is("deleted_at", null)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();
}

/**
 * The live tab named `name`, made last in the tab order when there is none.
 * A sheet tab that appears for the first time gets its own leads tab this
 * way. A deleted tab of the same name is not revived; a new one is made.
 */
export async function tabByName(supabase: SupabaseClient, name: string): Promise<WebhookTab> {
  const found = await liveTabByName(supabase, name);
  if (found.error) {
    console.error("[Leads Webhook] Tab read error:", found.error);
    return { error: "Failed to read tab", status: 500 };
  }
  if (found.data) {
    return { tabId: found.data.id as string, slug: found.data.slug as string, created: false };
  }

  // Every slug, deleted tabs included: the unique index on slug covers them.
  const [{ data: slugs, error: slugError }, { data: last, error: lastError }] = await Promise.all([
    typedFrom(supabase, "lead_tabs").select("slug"),
    typedFrom(supabase, "lead_tabs")
      .select("position")
      .is("deleted_at", null)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (slugError || lastError) {
    console.error("[Leads Webhook] Tab read error:", slugError ?? lastError);
    return { error: "Failed to create tab", status: 500 };
  }
  const taken = new Set(((slugs ?? []) as { slug: string }[]).map((r) => r.slug));
  const slug = nextFreeLeadTabSlug(deriveLeadTabSlug(name), taken);

  const { data: made, error: insertError } = await typedFrom(supabase, "lead_tabs")
    .insert({ slug, name, position: ((last?.position as number | undefined) ?? -1) + 1, is_default: false })
    .select("id, slug")
    .single();

  if (insertError) {
    // Two leads of a new sheet tab at once: the other request made it.
    const again = await liveTabByName(supabase, name);
    if (again.data) {
      return { tabId: again.data.id as string, slug: again.data.slug as string, created: false };
    }
    console.error("[Leads Webhook] Tab create error:", insertError);
    return { error: "Failed to create tab", status: 500 };
  }
  return { tabId: made.id as string, slug: made.slug as string, created: true };
}
