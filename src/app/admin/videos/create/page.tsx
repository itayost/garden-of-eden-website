import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Video } from "lucide-react";
import { VideoCreateForm } from "@/components/admin/videos/VideoCreateForm";

export default async function AdminCreateVideoPage() {
  const supabase = await createClient();

  // Verify admin role
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = (await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()) as { data: { role: string } | null };

  if (profile?.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back button */}
      <Button variant="ghost" asChild>
        <Link href="/admin/videos">
          <ArrowRight className="h-4 w-4 ml-2" />
          חזרה לרשימת סרטונים
        </Link>
      </Button>

      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">הוספת סרטון חדש</h1>
        <p className="text-muted-foreground">
          מלא את הפרטים להוספת סרטון תרגיל חדש
        </p>
      </div>

      {/* Form card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            פרטי הסרטון
          </CardTitle>
          <CardDescription>הזן את פרטי הסרטון החדש</CardDescription>
        </CardHeader>
        <CardContent>
          <VideoCreateForm />
        </CardContent>
      </Card>
    </div>
  );
}
