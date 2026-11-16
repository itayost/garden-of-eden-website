import { describe, expect, it } from "vitest";
import { fillName, firstNameOf } from "../fill-name";

describe("fillName", () => {
  it("replaces every placeholder", () => {
    expect(fillName("{שם}, כל הכבוד! ראינו, {שם}, שהשקעת.", "נועה")).toBe(
      "נועה, כל הכבוד! ראינו, נועה, שהשקעת.",
    );
  });

  it("leaves other braces alone", () => {
    expect(fillName("{name} {שם המאמן} {} {שם}", "דן")).toBe("{name} {שם המאמן} {} דן");
  });

  it("leaves a text without a placeholder as it is", () => {
    expect(fillName("שבוע טוב", "דן")).toBe("שבוע טוב");
  });
});

describe("firstNameOf", () => {
  it("takes the first word of the full name", () => {
    expect(firstNameOf("יוסי כהן")).toBe("יוסי");
    expect(firstNameOf("  מאיה   בר לב ")).toBe("מאיה");
    expect(firstNameOf("עידו")).toBe("עידו");
  });

  it("falls back to השחקן without a name", () => {
    expect(firstNameOf(null)).toBe("השחקן");
    expect(firstNameOf("")).toBe("השחקן");
    expect(firstNameOf("   ")).toBe("השחקן");
  });
});
