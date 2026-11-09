import type { Metadata } from "next";
import Link from "next/link";
import { TermsBody } from "@/features/enrollment/components/TermsSheet";
import { JoinFrame, termsHref } from "@/features/enrollment/components/JoinFrame";
import { LANDING_BRANCHES, landingBranchByKey } from "@/lib/branches/landing-branches";
import { termsFor } from "../../../../content/terms";

interface PageProps {
  searchParams: Promise<{ branch?: string }>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const branch = landingBranchByKey((await searchParams).branch);
  return { title: `${branch ? termsFor(branch.key).title : "תקנון"} | Garden of Eden` };
}

/** One branch's תקנון (?branch=), or the list of them. */
export default async function TermsPage({ searchParams }: PageProps) {
  const branch = landingBranchByKey((await searchParams).branch);
  return (
    <JoinFrame branch={branch}>
      <article className="mx-auto max-w-3xl rounded-3xl border bg-white p-6 sm:p-10">
        {branch ? (
          <>
            <h1 className="mb-6 text-3xl font-bold">{termsFor(branch.key).title}</h1>
            <TermsBody branch={branch.key} />
          </>
        ) : (
          <>
            <h1 className="mb-6 text-3xl font-bold">תקנון</h1>
            <ul className="space-y-2">
              {LANDING_BRANCHES.map((b) => (
                <li key={b.key}>
                  <Link href={termsHref(b)} className="text-lg underline underline-offset-4">
                    {termsFor(b.key).title}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </article>
    </JoinFrame>
  );
}
