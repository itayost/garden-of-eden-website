import { redirect } from "next/navigation";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { isValidUUID } from "@/lib/validations/common";
import { getReportData } from "@/features/player-report/lib/actions";
import { ReportEditor } from "@/features/player-report/components/ReportEditor";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface PageProps {
  params: Promise<{ userId: string }>;
}

export default async function GenerateReportPage({ params }: PageProps) {
  const { userId } = await params;

  const auth = await verifyAdminOrTrainer();
  if (auth.error) {
    redirect("/auth/login");
  }

  if (!isValidUUID(userId)) {
    redirect("/admin/users");
  }

  // Default date range: last 3 months
  const now = new Date();
  const toDate = now.toISOString().split("T")[0];
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setDate(threeMonthsAgo.getDate() - 90);
  const fromDate = threeMonthsAgo.toISOString().split("T")[0];

  const { data, error } = await getReportData(userId, fromDate, toDate);

  if (error || !data) {
    redirect("/admin/users");
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-muted-foreground">
        <Link href="/admin/users" className="hover:text-foreground">
          ניהול משתמשים
        </Link>
        <ArrowRight className="h-4 w-4 rotate-180" />
        <Link
          href={`/admin/users/${userId}`}
          className="hover:text-foreground"
        >
          {data.profile.full_name ?? "שחקן"}
        </Link>
        <ArrowRight className="h-4 w-4 rotate-180" />
        <span>הפקת סיכום שחקן</span>
      </div>

      <ReportEditor
        initialData={data}
        userId={userId}
        initialFromDate={fromDate}
        initialToDate={toDate}
      />
    </div>
  );
}
