import { describe, expect, it } from "vitest";
import { purchaseRequestShareUrl } from "../purchase-request";

describe("purchaseRequestShareUrl", () => {
  it("opens WhatsApp to the parent with the child's request and the link", () => {
    const url = purchaseRequestShareUrl("+972521234567", "נועם", "https://www.edengarden.co.il/join?renew=t-1.2.3");
    expect(url.startsWith("https://wa.me/972521234567?text=")).toBe(true);
    const text = decodeURIComponent(url.split("?text=")[1]);
    expect(text).toContain("נועם");
    expect(text).toContain("https://www.edengarden.co.il/join?renew=t-1.2.3");
  });
});
