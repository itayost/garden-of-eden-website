import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { MessageCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "הרשמה לסניף קריית אתא | Garden of Eden",
  description: "בחירת מסלול אימונים, חתימה על הסכם ההרשמה ותשלום מאובטח.",
  alternates: { canonical: "/join" },
};

/**
 * One narrow column: the whole flow is filled in on a phone from a WhatsApp
 * link. The bottom padding leaves room for the sticky submit bar on mobile.
 */
export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main-content" tabIndex={-1} className="outline-none min-h-screen bg-paper">
      <header className="sticky top-0 z-40 border-b border-black/5 bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <Link href="/kiryat-ata" className="flex items-center gap-2">
            <Image src="/logo-transparent.png" alt="Garden of Eden" width={32} height={32} className="h-8 w-8 object-contain" />
            <span className="text-sm font-bold">
              GARDEN OF EDEN
              <span className="block text-[11px] font-normal text-black/60">סניף קריית אתא</span>
            </span>
          </Link>
          <a
            href="https://wa.me/972525779446"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#25D366] text-ink"
            aria-label="שאלה בוואטסאפ"
          >
            <MessageCircle className="h-5 w-5" />
          </a>
        </div>
      </header>
      <div className="mx-auto max-w-2xl px-4 pb-32 pt-6 sm:pb-12 sm:pt-10">{children}</div>
      <footer className="border-t border-black/5 py-6 text-center text-xs text-black/60">
        <Link href="/join/terms" className="underline">תקנון</Link>
        {" · "}
        <Link href="/cancellation-policy" className="underline">מדיניות ביטול</Link>
        {" · "}
        <Link href="/privacy-policy" className="underline">פרטיות</Link>
      </footer>
    </main>
  );
}
