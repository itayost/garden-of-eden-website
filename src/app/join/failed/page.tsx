import Link from "next/link";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { JoinFrame } from "@/features/enrollment/components/JoinFrame";
import { landingBranchOfOrder } from "@/features/enrollment/lib/catalog";
import { joinHref } from "@/lib/branches/landing-branches";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "התשלום לא הושלם", robots: { index: false, follow: false } };

interface PageProps {
  searchParams: Promise<{ order?: string }>;
}

export default async function JoinFailedPage({ searchParams }: PageProps) {
  const branch = await landingBranchOfOrder((await searchParams).order);
  return (
    <JoinFrame branch={branch}>
      <div className="mx-auto max-w-lg space-y-4 rounded-3xl border bg-white p-10 text-center">
        <XCircle className="mx-auto h-12 w-12 text-destructive" />
        <h1 className="text-2xl font-bold">התשלום לא הושלם</h1>
        <p className="text-black/60">לא חויבתם. אפשר לנסות שוב או לדבר איתנו בוואטסאפ.</p>
        <Button asChild>
          <Link href={branch ? joinHref(branch.key) : "/join"}>חזרה לבחירת מסלול</Link>
        </Button>
      </div>
    </JoinFrame>
  );
}
