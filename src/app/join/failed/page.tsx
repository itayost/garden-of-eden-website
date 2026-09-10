import Link from "next/link";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "התשלום לא הושלם", robots: { index: false, follow: false } };

export default function JoinFailedPage() {
  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-3xl border bg-white p-10 text-center">
      <XCircle className="mx-auto h-12 w-12 text-destructive" />
      <h1 className="text-2xl font-bold">התשלום לא הושלם</h1>
      <p className="text-black/60">לא חויבתם. אפשר לנסות שוב או לדבר איתנו בוואטסאפ.</p>
      <Button asChild>
        <Link href="/join">חזרה לבחירת מסלול</Link>
      </Button>
    </div>
  );
}
