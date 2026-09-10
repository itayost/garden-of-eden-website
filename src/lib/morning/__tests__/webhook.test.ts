import { describe, it, expect } from "vitest";
import { createHmac } from "crypto";
import { extractOrderId, verifyMorningSignature } from "../webhook";

const SECRET = "whsec_test";
const BODY = '{"id":"p1","custom":{"orderId":"o1"}}';
const GOOD = createHmac("sha256", SECRET).update(BODY).digest("hex");

describe("verifyMorningSignature", () => {
  it("accepts the hex HMAC of the raw body", () => {
    expect(verifyMorningSignature(BODY, GOOD, SECRET)).toBe(true);
  });
  it("rejects a missing, wrong-length, or wrong signature", () => {
    expect(verifyMorningSignature(BODY, null, SECRET)).toBe(false);
    expect(verifyMorningSignature(BODY, "abcd", SECRET)).toBe(false);
    expect(verifyMorningSignature(BODY + " ", GOOD, SECRET)).toBe(false);
  });
});

describe("extractOrderId", () => {
  const ID = "11111111-1111-4111-8111-111111111111";
  it("reads a plain uuid string", () => {
    expect(extractOrderId(ID)).toBe(ID);
  });
  it("reads orderId or the first uuid-looking value from an object", () => {
    expect(extractOrderId({ orderId: ID })).toBe(ID);
    expect(extractOrderId({ value: ID })).toBe(ID);
    expect(extractOrderId({ a: "x", b: ID })).toBe(ID);
  });
  it("returns null for anything else", () => {
    expect(extractOrderId("not-a-uuid")).toBeNull();
    expect(extractOrderId(null)).toBeNull();
    expect(extractOrderId({ a: 1 })).toBeNull();
  });
});
