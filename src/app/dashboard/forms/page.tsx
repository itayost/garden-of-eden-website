import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

import { ActionTile, type ActionTileIcon } from "@/components/dashboard/ActionTile";

export const metadata: Metadata = {
  title: "טפסים | Garden of Eden",
};

export default async function FormsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Explicit auth check - redirect if not authenticated
  if (!user) {
    redirect("/auth/login?redirect=/dashboard/forms");
  }

  const { data: nutritionForm } = await supabase
    .from("nutrition_forms")
    .select("id")
    .eq("user_id", user?.id || "")
    .maybeSingle();

  const hasCompletedNutrition = !!nutritionForm;

  const forms: Array<{
    title: string;
    subtitle: string;
    icon: ActionTileIcon;
    href: string;
    completed?: boolean;
  }> = [
    {
      title: "שאלון לפני אימון",
      subtitle: "למילוי לפני כל אימון",
      icon: "activity",
      href: "/dashboard/forms/pre-workout",
    },
    {
      title: "שאלון אחרי אימון",
      subtitle: "למילוי אחרי כל אימון",
      icon: "clipboard-check",
      href: "/dashboard/forms/post-workout",
    },
    {
      title: "שאלון תזונה",
      subtitle: hasCompletedNutrition ? "אין צורך למלא שוב" : "חובה באימון ראשון",
      icon: "salad",
      href: "/dashboard/forms/nutrition",
      completed: hasCompletedNutrition,
    },
    {
      title: "שאלון מנטלי",
      subtitle: "אחרי כל מפגש זום עם עומר",
      icon: "brain",
      href: "/dashboard/forms/mental",
    },
  ];

  return (
    <div className="space-y-6 md:space-y-8">
      <div>
        <h1 className="font-display text-3xl text-forest sm:text-4xl">שאלונים</h1>
        <p className="text-sm text-muted-foreground">
          מילוי השאלונים עוזר לנו להתאים את האימונים בצורה הטובה ביותר עבורך
        </p>
      </div>

      {/* The same ActionTile as the home page — one action language app-wide. */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {forms.map((form) => (
          <ActionTile
            key={form.href}
            href={form.href}
            icon={form.icon}
            title={form.title}
            subtitle={form.subtitle}
            completed={form.completed}
          />
        ))}
      </div>
    </div>
  );
}
