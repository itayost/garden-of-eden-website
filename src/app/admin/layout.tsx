import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminNav } from "@/components/admin/AdminNav";
import { AdminBottomNav } from "@/components/admin/AdminBottomNav";
import type { Profile } from "@/types/database";

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

  // Check if user is admin or trainer
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single() as { data: Profile | null };

  if (profile?.role !== "admin" && profile?.role !== "trainer") {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <AdminNav user={user} profile={profile} />
      <main className="container mx-auto px-4 pt-8 pb-20 md:pb-8">
        {children}
      </main>
      <AdminBottomNav />
    </div>
  );
}
