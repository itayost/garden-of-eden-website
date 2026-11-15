import { describe, expect, it } from "vitest";
import {
  LANDING_BRANCHES,
  joinHref,
  landingBranchByKey,
  landingBranchByName,
  pickJoinBranch,
  type JoinBranchOption,
} from "../landing-branches";

const haifa: JoinBranchOption = { key: "haifa", nameHe: "חיפה", path: "/", id: "b-haifa", sells: true };
const kiryat: JoinBranchOption = { key: "kiryat_ata", nameHe: "קריית אתא", path: "/kiryat-ata", id: "b-kiryat", sells: true };
const both = [haifa, kiryat];
const none = { renewal: [], productBranchId: null, requestedKey: null };

describe("landing branch lookups", () => {
  it("finds a branch by its key and by its database name", () => {
    expect(landingBranchByKey("haifa")?.nameHe).toBe("חיפה");
    expect(landingBranchByName("קריית אתא")?.key).toBe("kiryat_ata");
  });

  it("answers null for anything it does not know", () => {
    expect(landingBranchByKey("tel_aviv")).toBeNull();
    expect(landingBranchByKey(null)).toBeNull();
    expect(landingBranchByName("תל אביב")).toBeNull();
    expect(landingBranchByName(undefined)).toBeNull();
  });

  it("gives every landing page its own key, branch and path", () => {
    const unique = (values: string[]) => new Set(values).size === values.length;
    expect(unique(LANDING_BRANCHES.map((b) => b.key))).toBe(true);
    expect(unique(LANDING_BRANCHES.map((b) => b.nameHe))).toBe(true);
    expect(unique(LANDING_BRANCHES.map((b) => b.path))).toBe(true);
  });
});

describe("joinHref", () => {
  it("names the branch, and the product when one is chosen", () => {
    expect(joinHref("haifa")).toBe("/join?branch=haifa");
    expect(joinHref("kiryat_ata", "p-1")).toBe("/join?branch=kiryat_ata&product=p-1");
  });
});

describe("pickJoinBranch", () => {
  it("follows a renewal link to the branch of the Plan it renews", () => {
    const hints = { renewal: ["b-haifa"], productBranchId: "b-kiryat", requestedKey: "kiryat_ata" };
    expect(pickJoinBranch(both, hints)).toBe(haifa);
  });

  it("prefers a selling branch among a trainee's branches", () => {
    const quiet = { ...haifa, sells: false };
    expect(pickJoinBranch([quiet, kiryat], { ...none, renewal: ["b-haifa", "b-kiryat"] })).toBe(kiryat);
  });

  it("keeps a renewal's branch even when it sells nothing now, so the page says so", () => {
    const quiet = { ...haifa, sells: false };
    expect(pickJoinBranch([quiet, kiryat], { ...none, renewal: ["b-haifa"] })).toBe(quiet);
  });

  it("skips renewal branches with no landing page and goes on to the next hint", () => {
    expect(pickJoinBranch(both, { renewal: ["b-elsewhere"], productBranchId: null, requestedKey: "haifa" })).toBe(haifa);
  });

  it("takes the chosen product's branch over the requested one", () => {
    expect(pickJoinBranch(both, { ...none, productBranchId: "b-kiryat", requestedKey: "haifa" })).toBe(kiryat);
  });

  it("takes the requested branch, even one with nothing on sale", () => {
    const quiet = { ...haifa, sells: false };
    expect(pickJoinBranch([quiet, kiryat], { ...none, requestedKey: "haifa" })).toBe(quiet);
  });

  it("opens the only selling branch when nothing names one", () => {
    const quiet = { ...haifa, sells: false };
    expect(pickJoinBranch([quiet, kiryat], none)).toBe(kiryat);
  });

  it("asks which branch when several sell and nothing names one", () => {
    expect(pickJoinBranch(both, none)).toBeNull();
    expect(pickJoinBranch(both, { ...none, requestedKey: "tel_aviv" })).toBeNull();
  });

  it("finds nothing when no branch sells", () => {
    expect(pickJoinBranch([{ ...haifa, sells: false }], none)).toBeNull();
    expect(pickJoinBranch([], none)).toBeNull();
  });
});
