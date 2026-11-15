import Link from "next/link";
import Image from "next/image";
import { MessageCircle } from "lucide-react";
import type { LandingBranch } from "@/lib/branches/landing-branches";

/** Where the footer's תקנון link goes: the branch's own terms, or the list of them. */
export const termsHref = (branch: LandingBranch | null) =>
  branch ? `/join/terms?branch=${branch.key}` : "/join/terms";

/**
 * The /join pages' frame: one narrow column, since the whole flow is filled
 * in on a phone from a WhatsApp link. The header names the branch the parent
 * is buying at and leads back to its landing page; the footer links that
 * branch's terms. With no branch known, it names none. The bottom padding
 * leaves room for the sticky submit bar on mobile.
 */
export function JoinFrame({ branch, children }: { branch: LandingBranch | null; children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-black/5 bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <Link href={branch?.path ?? "/"} className="flex items-center gap-2">
            <Image src="/logo-transparent.png" alt="Garden of Eden" width={32} height={32} className="h-8 w-8 object-contain" />
            <span className="text-sm font-bold">
              GARDEN OF EDEN
              {branch && <span className="block text-[11px] font-normal text-black/60">סניף {branch.nameHe}</span>}
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
        <Link href={termsHref(branch)} className="underline">תקנון</Link>
        {" · "}
        <Link href="/cancellation-policy" className="underline">מדיניות ביטול</Link>
        {" · "}
        <Link href="/privacy-policy" className="underline">פרטיות</Link>
      </footer>
    </>
  );
}
