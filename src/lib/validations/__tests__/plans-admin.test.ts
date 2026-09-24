import { describe, expect, it } from "vitest";
import { arboxPlanSchema, newTraineeSchema, staffPaymentSchema } from "../plans-admin";

const UUID = "11111111-2222-4333-8444-555555555555";

describe("staffPaymentSchema", () => {
  it("accepts a cash payment and defaults confirmDuplicate to false", () => {
    const parsed = staffPaymentSchema.parse({
      traineeId: UUID,
      productId: UUID,
      paymentMethod: "cash",
      reference: "",
      sendWhatsApp: true,
    });
    expect(parsed.reference).toBeNull();
    expect(parsed.confirmDuplicate).toBe(false);
  });

  it("refuses arbox: an Arbox plan has its own action with its own terms", () => {
    const result = staffPaymentSchema.safeParse({
      traineeId: UUID,
      productId: UUID,
      paymentMethod: "arbox",
      reference: "",
      sendWhatsApp: false,
    });
    expect(result.success).toBe(false);
  });

  it("refuses card: cards only come from the payment page", () => {
    const result = staffPaymentSchema.safeParse({
      traineeId: UUID,
      productId: UUID,
      paymentMethod: "card",
      reference: "",
      sendWhatsApp: true,
    });
    expect(result.success).toBe(false);
  });
});

describe("newTraineeSchema", () => {
  it("needs only the child, two phones, product, and method", () => {
    const parsed = newTraineeSchema.parse({
      productId: UUID,
      childName: "דני כהן",
      loginPhone: "0521234567",
      payerPhone: "0521234567",
      parentName: "",
      paymentMethod: "bit",
      reference: "1234",
      startsOn: "2026-09-11",
      sendWhatsApp: true,
    });
    expect(parsed.loginPhone).toBe("+972521234567");
    expect(parsed.parentName).toBeNull();
    expect(parsed.reference).toBe("1234");
  });

  it("normalizes Auth and punctuated phone spellings", () => {
    const parsed = newTraineeSchema.parse({
      productId: UUID,
      childName: "דני כהן",
      loginPhone: "972521234567",
      payerPhone: "052-123-4567",
      parentName: "",
      paymentMethod: "bit",
      reference: "",
      startsOn: "2026-09-11",
      sendWhatsApp: true,
    });
    expect(parsed.loginPhone).toBe("+972521234567");
    expect(parsed.payerPhone).toBe("+972521234567");
  });

  it("rejects a multi-line child name", () => {
    const result = newTraineeSchema.safeParse({
      productId: UUID,
      childName: "דני\nכהן",
      loginPhone: "0521234567",
      payerPhone: "0521234567",
      parentName: "",
      paymentMethod: "cash",
      reference: "",
      startsOn: "2026-09-11",
      sendWhatsApp: true,
    });
    expect(result.success).toBe(false);
  });
});

describe("arboxPlanSchema", () => {
  const valid = {
    traineeId: UUID,
    productId: UUID,
    startsOn: "2026-09-24",
    endsOn: "2026-12-23",
    sessionsTotal: 20,
    amountIls: 2000,
    reference: "",
  };

  it("accepts what Arbox sold and defaults confirmDuplicate to false", () => {
    const parsed = arboxPlanSchema.parse(valid);
    expect(parsed.sessionsTotal).toBe(20);
    expect(parsed.amountIls).toBe(2000);
    expect(parsed.reference).toBeNull();
    expect(parsed.confirmDuplicate).toBe(false);
  });

  it("accepts no sessions for a subscription", () => {
    expect(arboxPlanSchema.safeParse({ ...valid, sessionsTotal: null }).success).toBe(true);
  });

  it("accepts a plan that starts and ends on the same day", () => {
    expect(arboxPlanSchema.safeParse({ ...valid, endsOn: valid.startsOn }).success).toBe(true);
  });

  it("refuses an end date before the start date", () => {
    const result = arboxPlanSchema.safeParse({ ...valid, endsOn: "2026-09-23" });
    expect(result.success).toBe(false);
  });

  it("refuses zero sessions and a zero amount", () => {
    expect(arboxPlanSchema.safeParse({ ...valid, sessionsTotal: 0 }).success).toBe(false);
    expect(arboxPlanSchema.safeParse({ ...valid, amountIls: 0 }).success).toBe(false);
  });

  it("refuses a malformed date", () => {
    expect(arboxPlanSchema.safeParse({ ...valid, startsOn: "24/09/2026" }).success).toBe(false);
  });
});
