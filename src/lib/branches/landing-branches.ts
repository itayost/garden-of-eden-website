/**
 * The branches with a public landing page, and how /join knows which one a
 * parent is buying at. The database names a branch by `branches.name_he`;
 * the landing pages, their terms and their links name it by key.
 */
export type LandingBranchKey = "haifa" | "kiryat_ata";

export interface LandingBranch {
  key: LandingBranchKey;
  /** `branches.name_he` */
  nameHe: string;
  /** The branch's landing page. */
  path: string;
}

/** In the branches' own order (branches.order_index). */
export const LANDING_BRANCHES: readonly LandingBranch[] = [
  { key: "haifa", nameHe: "חיפה", path: "/" },
  { key: "kiryat_ata", nameHe: "קריית אתא", path: "/kiryat-ata" },
];

export function landingBranchByKey(key: string | null | undefined): LandingBranch | null {
  return LANDING_BRANCHES.find((b) => b.key === key) ?? null;
}

export function landingBranchByName(nameHe: string | null | undefined): LandingBranch | null {
  return LANDING_BRANCHES.find((b) => b.nameHe === nameHe) ?? null;
}

/** /join for one branch, with a product already chosen when given. */
export function joinHref(key: LandingBranchKey, productId?: string): string {
  const params = new URLSearchParams({ branch: key });
  if (productId) params.set("product", productId);
  return `/join?${params.toString()}`;
}

/** A landing branch as /join sees it: its row, and whether anything is on sale there. */
export interface JoinBranchOption extends LandingBranch {
  id: string;
  sells: boolean;
}

export interface JoinBranchHints {
  /**
   * The branches a renewal link points at, strongest first: the branch of the
   * Plan it renews, else the trainee's own branches.
   */
  renewal: readonly string[];
  /** The branch of the product named in the link (?product=). */
  productBranchId: string | null;
  /** ?branch= */
  requestedKey: string | null;
}

/**
 * The branch whose catalog /join shows. The strongest hint wins: a renewal
 * link, then the chosen product, then ?branch=. A named branch is kept even
 * when nothing is on sale there, so the parent reads that rather than another
 * branch's prices. With no hint, the only selling branch opens; null means
 * the parent picks one (or, when none sells, that nothing is open).
 */
export function pickJoinBranch(
  options: readonly JoinBranchOption[],
  hints: JoinBranchHints,
): JoinBranchOption | null {
  const renewal = hints.renewal
    .map((id) => options.find((o) => o.id === id))
    .filter((o): o is JoinBranchOption => o !== undefined);
  if (renewal.length > 0) return renewal.find((o) => o.sells) ?? renewal[0];

  const byProduct = options.find((o) => o.id === hints.productBranchId);
  if (byProduct) return byProduct;

  const requested = options.find((o) => o.key === hints.requestedKey);
  if (requested) return requested;

  const selling = options.filter((o) => o.sells);
  return selling.length === 1 ? selling[0] : null;
}
