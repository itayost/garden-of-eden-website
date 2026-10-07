import { describe, expect, it } from "vitest";
import { receiptClient } from "../receipt-client";

describe("receiptClient", () => {
  it("addresses the receipt to the player, not the parent placeholder", () => {
    const client = receiptClient({
      child_name: "דני כהן",
      parent_name: "הורה",
      payer_phone: "+972521234567",
      email: null,
    });
    expect(client).toEqual({ name: "דני כהן", phone: "+972521234567", email: null });
  });

  it("addresses it to the player even when the parent's name is known", () => {
    const client = receiptClient({
      child_name: "  נועה לוי ",
      parent_name: "רונית לוי",
      payer_phone: "+972541112233",
      email: "ronit@example.com",
    });
    expect(client).toEqual({ name: "נועה לוי", phone: "+972541112233", email: "ronit@example.com" });
  });
});
