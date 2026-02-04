import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, ClipboardCheck, Salad, CheckCircle2, ArrowLeft } from "lucide-react";

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
    .single();

  const hasCompletedNutrition = !!nutritionForm;

  const forms = [
    {
      title: "שאלון לפני אימון",
      description: "יש למלא לפני כל אימון - עוזר לנו להתאים את האימון למצבך",
      icon: Activity,
      href: "/dashboard/forms/pre-workout",
      color: "bg-blue-500",
      badge: "למילוי לפני כל אימון",
      badgeColor: "bg-blue-100 text-blue-700",
    },
    {
      title: "שאלון אחרי אימון",
      description: "יש למלא אחרי כל אימון - עוזר לנו לשפר את האימונים",
      icon: ClipboardCheck,
      href: "/dashboard/forms/post-workout",
      color: "bg-green-500",
      badge: "למילוי אחרי כל אימון",
      badgeColor: "bg-green-100 text-green-700",
    },
    {
      title: "שאלון תזונה",
      description: "שאלון מקיף על הרגלי התזונה שלך - יש למלא פעם אחת",
      icon: Salad,
      href: "/dashboard/forms/nutrition",
      color: "bg-orange-500",
      badge: hasCompletedNutrition ? "הושלם" : "חובה באימון ראשון",
      badgeColor: hasCompletedNutrition
        ? "bg-green-100 text-green-700"
        : "bg-orange-100 text-orange-700",
      completed: hasCompletedNutrition,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">שאלונים</h1>
        <p className="text-muted-foreground">
          מילוי השאלונים עוזר לנו להתאים את האימונים בצורה הטובה ביותר עבורך
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {forms.map((form) => (
          <Link key={form.href} href={form.href}>
            <Card className="h-full hover:shadow-lg transition-all cursor-pointer group border-2 hover:border-primary/50">
              <CardHeader>
                <div className="flex items-start justify-between mb-4">
                  <div className={`${form.color} rounded-xl p-4 group-hover:scale-110 transition-transform`}>
                    <form.icon className="h-8 w-8 text-white" />
                  </div>
                  <Badge className={form.badgeColor}>
                    {form.completed && <CheckCircle2 className="h-3 w-3 ml-1" />}
                    {form.badge}
                  </Badge>
                </div>
                <CardTitle className="text-xl">{form.title}</CardTitle>
                <CardDescription className="text-base">
                  {form.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-primary font-medium group-hover:gap-2 transition-all">
                  {form.completed ? "צפייה בתשובות" : "למילוי השאלון"}
                  <ArrowLeft className="h-4 w-4 mr-1" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
