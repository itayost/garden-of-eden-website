import type { LandingBranchKey } from "@/lib/branches/landing-branches";
import { HAIFA_TERMS_SECTIONS, HAIFA_TERMS_VERSION } from "./terms-haifa";
import { TERMS_SECTIONS, TERMS_VERSION, type TermsSection } from "./terms-kiryat-ata";

/** The one section that differs between branches: what each one sells. */
export const PLANS_SECTION_TITLE = "המסלולים";

export interface BranchTerms {
  /** Stored on every agreement signed on these terms. */
  version: string;
  title: string;
  sections: readonly TermsSection[];
}

/** The terms a parent signs, per branch. */
export const BRANCH_TERMS: Record<LandingBranchKey, BranchTerms> = {
  haifa: { version: HAIFA_TERMS_VERSION, title: "תקנון סניף חיפה", sections: HAIFA_TERMS_SECTIONS },
  kiryat_ata: { version: TERMS_VERSION, title: "תקנון סניף קריית אתא", sections: TERMS_SECTIONS },
};

/**
 * A branch's terms. A branch with no landing page signs the קריית אתא terms,
 * the ones every agreement used before Haifa had its own.
 */
export function termsFor(key: LandingBranchKey | null | undefined): BranchTerms {
  return key ? BRANCH_TERMS[key] : BRANCH_TERMS.kiryat_ata;
}
