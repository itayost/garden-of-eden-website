import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { MessageCircle } from "lucide-react";
import { ReportBody } from "@/features/weekly-reports/components/report/ReportBody";
import { loadParentView, type ParentView } from "@/features/weekly-reports/lib/queries/parent-view";
import { verifyReportToken } from "@/features/weekly-reports/lib/report-token";
import { isLinkPreviewAgent } from "@/features/weekly-reports/lib/report-view";
import { planTokenSecret } from "@/lib/plans/token-secret";
import { createAdminClient } from "@/lib/supabase/admin";
import { israelToday } from "@/lib/utils/tasks";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "הדוח השבועי",
  robots: { index: false, follow: false },
};

const WHATSAPP_URL = "https://wa.me/972525779446";

interface PageProps {
  params: Promise<{ token: string }>;
}

/** The report id of a valid, unexpired report token, or null. */
function reportIdOf(token: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(token);
  } catch {
    return null;
  }
  try {
    return verifyReportToken(decoded, Math.floor(Date.now() / 1000), planTokenSecret());
  } catch (error) {
    // Only planTokenSecret() throws: the secret is not set.
    console.error("[weekly-reports] report link check failed:", error instanceof Error ? error.message : error);
    return null;
  }
}

/** The sent report, or null for every other case, which all show one notice. */
async function viewFor(token: string): Promise<ParentView | null> {
  const reportId = reportIdOf(token);
  if (!reportId) return null;
  try {
    // A link preview (WhatsApp draws one) is not the parent opening it.
    const userAgent = (await headers()).get("user-agent");
    return await loadParentView(createAdminClient(), reportId, israelToday(), {
      recordOpen: !isLinkPreviewAgent(userAgent),
    });
  } catch (error) {
    console.error("[weekly-reports] parent page failed:", error instanceof Error ? error.message : error);
    return null;
  }
}

function ReportFrame({ children }: { children: React.ReactNode }) {
  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-paper outline-none">
      <header className="border-b border-black/5">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/logo-transparent.png"
              alt="Garden of Eden"
              width={32}
              height={32}
              priority
              className="h-8 w-8 object-contain"
            />
            <span className="text-sm font-bold">GARDEN OF EDEN</span>
          </Link>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#25D366] text-ink"
            aria-label="שאלה בוואטסאפ"
          >
            <MessageCircle className="h-5 w-5" aria-hidden="true" />
          </a>
        </div>
      </header>
      <div className="mx-auto max-w-2xl px-4 pb-12 pt-6 sm:pt-10">{children}</div>
    </main>
  );
}

/** One calm notice for a bad, expired or unknown link alike: it tells nothing about the report. */
function ReportNotice() {
  return (
    <section className="rounded-2xl border border-black/5 bg-white p-4 text-sm sm:p-6">
      <p>הקישור לא תקין או שפג תוקפו. לשאלות אפשר לפנות אלינו בוואטסאפ.</p>
    </section>
  );
}

/**
 * The parent's Weekly report, opened from the WhatsApp link without a login.
 * The signed token is checked before anything is read; only a sent report is
 * shown, and its first open is recorded.
 */
export default async function WeeklyReportPage({ params }: PageProps) {
  const { token } = await params;
  const view = await viewFor(token);
  return <ReportFrame>{view ? <ReportBody view={view} /> : <ReportNotice />}</ReportFrame>;
}
