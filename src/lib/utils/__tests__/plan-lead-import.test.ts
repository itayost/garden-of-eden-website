import { describe, expect, it } from "vitest";
import { leadNameKey, partitionTabMove, planLeadImport, type TabLeads } from "../plan-lead-import";

const row = (name: string, phone: string | null = null) => ({ name, phone });

const tab = (phones: string[], phonelessNames: string[] = []): TabLeads => ({
  phones: new Set(phones),
  phonelessNames: new Set(phonelessNames.map(leadNameKey)),
});

describe("leadNameKey", () => {
  it("matches names ignoring case and extra spaces", () => {
    expect(leadNameKey("  דני   כהן ")).toBe(leadNameKey("דני כהן"));
    expect(leadNameKey("Noa Levi")).toBe(leadNameKey("noa  levi"));
  });
});

describe("planLeadImport", () => {
  it("skips only rows whose phone is already in the target tab", () => {
    const plan = planLeadImport([row("דני", "972541111111"), row("נועה", "972542222222")], tab(["972541111111"]));
    expect(plan.insert.map((r) => r.name)).toEqual(["נועה"]);
    expect(plan.skipped).toBe(1);
  });

  it("skips a phone-less row whose name a phone-less lead in the tab already has, so pasting again adds nothing twice", () => {
    const plan = planLeadImport([row("יואב לוי"), row("אורי כהן")], tab([], ["יואב  לוי"]));
    expect(plan.insert.map((r) => r.name)).toEqual(["אורי כהן"]);
    expect(plan.skipped).toBe(1);
  });

  it("keeps a phone-less row whose name only a lead with a phone has", () => {
    const plan = planLeadImport([row("דני")], tab(["972541111111"], []));
    expect(plan.insert).toHaveLength(1);
  });

  it("adds a phone or phone-less name repeated within the same paste once", () => {
    const plan = planLeadImport(
      [row("רון", "972546000000"), row("גל", "972546000000"), row("בן"), row("בן ")],
      tab([]),
    );
    expect(plan.insert.map((r) => r.name)).toEqual(["רון", "בן"]);
    expect(plan.skipped).toBe(2);
  });
});

describe("partitionTabMove", () => {
  it("moves the phones the destination tab lacks and keeps those it already has", () => {
    expect(partitionTabMove(["972541111111", "972542222222", "972541111111"], new Set(["972542222222"]))).toEqual({
      move: ["972541111111"],
      keep: ["972542222222"],
    });
  });
});
