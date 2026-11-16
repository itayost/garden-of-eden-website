import { describe, expect, it } from "vitest";
import { signRenewalToken, signTraineeToken, verifyRenewalToken } from "@/lib/plans/renewal-token";
import { REPORT_TOKEN_TTL_SECONDS, signReportToken, verifyReportToken } from "../report-token";

const SECRET = "test-secret";
const REPORT = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const EXPIRES = 2_000_000_000;
const NOW = EXPIRES - REPORT_TOKEN_TTL_SECONDS;

/** The token with one of its four parts replaced. */
function withPart(token: string, index: number, value: string): string {
  return token
    .split(".")
    .map((part, i) => (i === index ? value : part))
    .join(".");
}

describe("report token", () => {
  it("lasts thirty days", () => {
    expect(REPORT_TOKEN_TTL_SECONDS).toBe(30 * 24 * 60 * 60);
  });

  it("is report.<id>.<expiry>.<mac>", () => {
    const parts = signReportToken(REPORT, EXPIRES, SECRET).split(".");
    expect(parts).toHaveLength(4);
    expect(parts.slice(0, 3)).toEqual(["report", REPORT, String(EXPIRES)]);
    expect(parts[3]).toMatch(/^[0-9a-f]{64}$/);
  });

  it("verifies a fresh token to its report id", () => {
    const token = signReportToken(REPORT, EXPIRES, SECRET);
    expect(verifyReportToken(token, NOW, SECRET)).toBe(REPORT);
    expect(verifyReportToken(token, EXPIRES - 1, SECRET)).toBe(REPORT);
  });

  it("refuses a token at and after its expiry", () => {
    const token = signReportToken(REPORT, EXPIRES, SECRET);
    expect(verifyReportToken(token, EXPIRES, SECRET)).toBeNull();
    expect(verifyReportToken(token, EXPIRES + 1, SECRET)).toBeNull();
  });

  it("refuses a changed id, expiry or MAC", () => {
    const token = signReportToken(REPORT, EXPIRES, SECRET);
    expect(verifyReportToken(withPart(token, 1, OTHER), NOW, SECRET)).toBeNull();
    expect(verifyReportToken(withPart(token, 2, String(EXPIRES + 1)), NOW, SECRET)).toBeNull();
    const flipped = token.endsWith("0") ? "1" : "0";
    expect(verifyReportToken(token.slice(0, -1) + flipped, NOW, SECRET)).toBeNull();
    expect(verifyReportToken(token.slice(0, -2) + "zz", NOW, SECRET)).toBeNull();
  });

  it("refuses an expiry spelled another way", () => {
    const token = signReportToken(REPORT, EXPIRES, SECRET);
    expect(verifyReportToken(withPart(token, 2, `0${EXPIRES}`), NOW, SECRET)).toBeNull();
    expect(verifyReportToken(withPart(token, 2, "2e9"), NOW, SECRET)).toBeNull();
    expect(verifyReportToken(withPart(token, 2, `${EXPIRES}.0`), NOW, SECRET)).toBeNull();
  });

  it("refuses a token signed with another secret", () => {
    const token = signReportToken(REPORT, EXPIRES, "another-secret");
    expect(verifyReportToken(token, NOW, SECRET)).toBeNull();
  });

  it("refuses a wrong prefix, a bad id or the wrong number of parts", () => {
    const token = signReportToken(REPORT, EXPIRES, SECRET);
    expect(verifyReportToken(withPart(token, 0, "renewal"), NOW, SECRET)).toBeNull();
    expect(verifyReportToken(withPart(token, 0, "REPORT"), NOW, SECRET)).toBeNull();
    expect(verifyReportToken(withPart(token, 1, "not-a-uuid"), NOW, SECRET)).toBeNull();
    expect(verifyReportToken(token.split(".").slice(1).join("."), NOW, SECRET)).toBeNull();
    expect(verifyReportToken(`${token}.extra`, NOW, SECRET)).toBeNull();
    expect(verifyReportToken("", NOW, SECRET)).toBeNull();
    expect(verifyReportToken("garbage", NOW, SECRET)).toBeNull();
  });

  it("refuses a multibyte MAC of the right length instead of throwing", () => {
    const forged = signReportToken(REPORT, EXPIRES, SECRET).slice(0, -1) + "א";
    expect(() => verifyReportToken(forged, NOW, SECRET)).not.toThrow();
    expect(verifyReportToken(forged, NOW, SECRET)).toBeNull();
  });
});

describe("report token against the purchase links", () => {
  it("does not accept a renewal token", () => {
    const renewal = signRenewalToken(REPORT, EXPIRES, SECRET);
    expect(verifyReportToken(renewal, NOW, SECRET)).toBeNull();
  });

  it("does not accept a trainee purchase token", () => {
    const trainee = signTraineeToken(REPORT, EXPIRES, SECRET);
    expect(verifyReportToken(trainee, NOW, SECRET)).toBeNull();
  });

  it("does not accept a renewal MAC moved under the report prefix", () => {
    const [planId, expires, mac] = signRenewalToken(REPORT, EXPIRES, SECRET).split(".");
    expect(verifyReportToken(`report.${planId}.${expires}.${mac}`, NOW, SECRET)).toBeNull();
  });

  it("is not accepted by verifyRenewalToken", () => {
    const token = signReportToken(REPORT, EXPIRES, SECRET);
    expect(verifyRenewalToken(token, SECRET, NOW)).toBeNull();
  });

  it("is not accepted by verifyRenewalToken with the prefix dropped", () => {
    const [, reportId, expires, mac] = signReportToken(REPORT, EXPIRES, SECRET).split(".");
    expect(verifyRenewalToken(`${reportId}.${expires}.${mac}`, SECRET, NOW)).toBeNull();
  });
});
