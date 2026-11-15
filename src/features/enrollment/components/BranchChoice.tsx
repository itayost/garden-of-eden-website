import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";
import { joinHref, type LandingBranch } from "@/lib/branches/landing-branches";

/**
 * /join reached with no branch named (an old link, the sitemap) while more
 * than one branch sells: the parent picks where the child trains.
 */
export function BranchChoice({ branches }: { branches: readonly LandingBranch[] }) {
  if (branches.length === 0) {
    return (
      <p className="rounded-2xl border bg-white p-8 text-center text-black/60">
        אין כרגע מסלולים פתוחים להרשמה. דברו איתנו בוואטסאפ.
      </p>
    );
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {branches.map((branch) => (
        <li key={branch.key}>
          <Link
            href={joinHref(branch.key)}
            className="flex items-center justify-between rounded-2xl border bg-white px-5 py-4 transition-colors hover:border-black/30"
          >
            <span className="flex items-center gap-2 text-lg font-bold">
              <MapPin className="h-5 w-5 text-black/60" aria-hidden="true" />
              סניף {branch.nameHe}
            </span>
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
